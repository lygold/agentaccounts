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

/**
 * Does this row belong to the session's office? The isolation backstop for
 * pages/actions that fetch a single row by primary key (`getDeal`,
 * `getAgentById`) — the key carries no `officeId`, so the query can't scope
 * itself. Pair with `notFound()`. Manager scope is "all agents", NOT "all
 * offices", so this check still bites for a manager.
 */
export function sameOffice(
  row: { officeId: string },
  session: SessionPayload,
): boolean {
  return row.officeId === session.officeId;
}

export function filterDealsByIds(deals: Deal[], allowed: Set<string> | "all"): Deal[] {
  if (allowed === "all") return deals;
  return deals.filter((d) => allowed.has(d.agentId));
}

/** Single-deal guard for the deal detail page — office first, then agent scope. */
export async function canSeeDeal(session: SessionPayload, deal: Deal): Promise<boolean> {
  if (!sameOffice(deal, session)) return false;
  return isIdAllowed(await allowedAgentIds(session), deal.agentId);
}
