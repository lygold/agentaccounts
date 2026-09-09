import "server-only";
import { fetchDafKesherRoster, type DafKesherAgent } from "../monday/roster";
import { createDafKesherItem, updateDafKesherItem } from "../monday/write";
import { isBootstrapAdmin } from "../auth/roles";
import {
  createAgent,
  listAgentsByOffice,
  updateAgent,
  type NewAgentInput,
} from "../store/agents";
import { DEFAULT_OFFICE_ID } from "../office";
import { getRedis, RedisKeys } from "../redis";
import type { AgentRecord } from "../types";
import type { AppRole } from "../monday/types";

/**
 * Phase 4d — the Daf Kesher ⇄ agents-table sync bridge, kept until Daf
 * Kesher is retired (ROADMAP Phase 10).
 *
 * INBOUND (`syncAgentsFromMonday`): the roster facts (name / phone / email /
 * team / team-leader / status) flow Monday → app. New Daf Kesher items become
 * agents. `role` is NEVER touched — it's app-owned. An app-side archive is
 * never undone by an "Active" on Monday, but a Monday "Inactive"/"Offboarding"
 * does archive the agent.
 *
 * OUTBOUND (`mirrorAgentToMonday`): admin edits in /admin/agents flow
 * app → Monday, fire-and-forget, with a Redis dead-letter on failure so the
 * admin UI never blocks and failures stay visible. Disable with
 * MONDAY_SYNC_ENABLED=false.
 *
 * No loop: inbound calls the store directly (not the admin actions), outbound
 * only runs from the actions, and both write the same value formats so the
 * next inbound pass sees no diff.
 */

// --- shared -----------------------------------------------------------------

/** Fields Monday owns during the bridge. */
const MIRRORED_KEYS = [
  "name",
  "email",
  "phone",
  "firstNameHebrew",
  "fullNameEnglish",
  "surname",
  "team",
  "isTeamLeader",
] as const;

function initialRole(m: DafKesherAgent): AppRole {
  if (isBootstrapAdmin(m.email ?? m.phone ?? undefined)) return "admin";
  return m.isTeamLeader ? "team_leader" : "agent";
}

function mondayOwnedInput(m: DafKesherAgent) {
  return {
    name: m.name,
    email: m.email,
    phone: m.phone,
    firstNameHebrew: m.firstNameHebrew,
    fullNameEnglish: m.fullNameEnglish,
    surname: m.surname,
    team: m.team,
    isTeamLeader: m.isTeamLeader,
  };
}

/** Only the Monday-owned fields that differ between the agent row and Daf Kesher. */
function diffMondayOwned(
  cur: AgentRecord,
  m: DafKesherAgent,
): Partial<AgentRecord> {
  const want = mondayOwnedInput(m);
  const patch: Partial<AgentRecord> = {};
  for (const k of MIRRORED_KEYS) {
    if (cur[k] !== want[k]) (patch as Record<string, unknown>)[k] = want[k];
  }
  return patch;
}

// --- inbound ---------------------------------------------------------------

export interface SyncResult {
  created: number;
  updated: number;
  archived: number;
  linked: number;
  unchanged: number;
  errors: string[];
}

export async function syncAgentsFromMonday(
  officeId: string = DEFAULT_OFFICE_ID,
): Promise<SyncResult> {
  const [roster, existing] = await Promise.all([
    fetchDafKesherRoster(),
    listAgentsByOffice(officeId, { includeArchived: true }),
  ]);

  const byMondayId = new Map(
    existing.filter((a) => a.mondayItemId).map((a) => [a.mondayItemId!, a]),
  );
  const res: SyncResult = {
    created: 0,
    updated: 0,
    archived: 0,
    linked: 0,
    unchanged: 0,
    errors: [],
  };

  for (const m of roster) {
    try {
      const mondayArchived =
        m.mondayStatus === "Inactive" || m.mondayStatus === "Offboarding";
      const cur = byMondayId.get(m.mondayItemId);

      if (cur) {
        const patch = diffMondayOwned(cur, m);
        if (mondayArchived && cur.status === "active") patch.status = "archived";
        if (Object.keys(patch).length === 0) {
          res.unchanged++;
        } else {
          await updateAgent(cur.id, patch);
          if (patch.status === "archived") res.archived++;
          else res.updated++;
        }
        continue;
      }

      // No agent linked to this Monday item. If an app-created agent already
      // holds the same contact, link it rather than create a duplicate.
      const clash = existing.find(
        (a) =>
          !a.mondayItemId &&
          ((m.email && a.email === m.email) || (m.phone && a.phone === m.phone)),
      );
      if (clash) {
        await updateAgent(clash.id, {
          mondayItemId: m.mondayItemId,
          ...diffMondayOwned(clash, m),
        });
        res.linked++;
        continue;
      }

      const input: NewAgentInput = {
        officeId,
        mondayItemId: m.mondayItemId,
        name: m.name,
        email: m.email,
        phone: m.phone,
        firstNameHebrew: m.firstNameHebrew,
        fullNameEnglish: m.fullNameEnglish,
        surname: m.surname,
        team: m.team,
        isTeamLeader: m.isTeamLeader,
        role: initialRole(m),
      };
      const agent = await createAgent(input);
      if (mondayArchived) await updateAgent(agent.id, { status: "archived" });
      res.created++;
    } catch (e) {
      res.errors.push(
        `${m.name}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
  return res;
}

// --- outbound ------------------------------------------------------------

function mirrorEnabled(): boolean {
  return process.env.MONDAY_SYNC_ENABLED !== "false";
}

/**
 * Push an agent's roster facts to Daf Kesher. Never throws — a failure is
 * dead-lettered to Redis and logged. Call fire-and-forget from the admin
 * actions (`void mirrorAgentToMonday(agent)`).
 */
export async function mirrorAgentToMonday(agent: AgentRecord): Promise<void> {
  if (!mirrorEnabled()) {
    console.info(`[sync] mirror disabled — skipped ${agent.name} (${agent.id})`);
    return;
  }
  try {
    if (agent.mondayItemId) {
      await updateDafKesherItem(agent);
    } else {
      const mondayId = await createDafKesherItem(agent);
      await updateAgent(agent.id, { mondayItemId: mondayId });
    }
  } catch (e) {
    const entry = JSON.stringify({
      agentId: agent.id,
      name: agent.name,
      error: e instanceof Error ? e.message : String(e),
      at: new Date().toISOString(),
    });
    console.error("[sync] mirror to Daf Kesher failed:", entry);
    try {
      const redis = getRedis();
      await redis.lpush(RedisKeys.agentMirrorDeadletter, entry);
      await redis.ltrim(RedisKeys.agentMirrorDeadletter, 0, 199);
    } catch (redisErr) {
      console.error("[sync] could not dead-letter the failure:", redisErr);
    }
  }
}

export async function mirrorFailureCount(): Promise<number> {
  try {
    return await getRedis().llen(RedisKeys.agentMirrorDeadletter);
  } catch {
    return 0;
  }
}
