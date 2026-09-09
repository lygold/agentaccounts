import "server-only";
import type { SessionPayload } from "./session";
import { isManager } from "./session-cookie";
import { listAgentIdsInTeam } from "../store/agents";
import type { Deal } from "../types";

/**
 * The set of agent ids a session may see data for — scopes the deals list
 * and the per-agent ledger:
 *   - manager / admin : everyone      → "all"
 *   - team_leader      : themselves + every agent on the same team
 *   - agent            : themselves only
 *
 * As of Phase 4c this is id-based (the deal's `agentId` is the `agents`
 * table id). Deals created before the agent picker were migrated; any that
 * still carry a name simply won't match for a non-manager (managers see all).
 */
export async function allowedAgentIds(
  session: SessionPayload,
): Promise<Set<string> | "all"> {
  if (isManager(session)) return "all";

  const ids = new Set<string>([session.agentId]);
  if (session.role === "team_leader" && session.team != null) {
    for (const id of await listAgentIdsInTeam(session.officeId, session.team)) {
      ids.add(id);
    }
  }
  return ids;
}

export function isIdAllowed(allowed: Set<string> | "all", id: string): boolean {
  return allowed === "all" || allowed.has(id);
}

export function filterDealsByIds(deals: Deal[], allowed: Set<string> | "all"): Deal[] {
  if (allowed === "all") return deals;
  return deals.filter((d) => allowed.has(d.agentId));
}

/** Single-deal guard for the deal detail page. */
export async function canSeeDeal(session: SessionPayload, deal: Deal): Promise<boolean> {
  return isIdAllowed(await allowedAgentIds(session), deal.agentId);
}
