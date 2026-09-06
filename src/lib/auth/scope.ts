import "server-only";
import type { SessionPayload } from "./session";
import { isManager } from "./session-cookie";
import { listAgentNamesInDistrict } from "../monday/agents";
import type { Deal } from "../types";

/**
 * The set of agent *names* a session is allowed to see data for — used to
 * scope both the deals list and the per-agent ledger:
 *   - manager / admin : everyone  → returns "all"
 *   - team_leader      : themselves + every agent in the same רובע
 *                        (district = the team-grouping key on Daf Kesher)
 *   - agent            : themselves only
 *
 * KNOWN LIMITATION — deals and ledger entries created before the Phase 3
 * agent picker carry a *typed* agentName as their identity, not a Daf
 * Kesher pulse id. So matching here is by name string, not id. Once the
 * picker lands (real agentId + denormalised district) this should switch
 * to id matching. See TODO(phase-3) in src/app/deals/actions.ts.
 */
export async function allowedAgentNames(
  session: SessionPayload,
): Promise<Set<string> | "all"> {
  if (isManager(session)) return "all";

  const names = new Set<string>([session.agentName]);
  if (session.role === "team_leader" && session.district != null) {
    for (const n of await listAgentNamesInDistrict(session.district)) {
      names.add(n);
    }
  }
  return names;
}

export function isNameAllowed(allowed: Set<string> | "all", name: string): boolean {
  return allowed === "all" || allowed.has(name);
}

export function filterDealsByNames(deals: Deal[], allowed: Set<string> | "all"): Deal[] {
  if (allowed === "all") return deals;
  return deals.filter((d) => allowed.has(d.agentName));
}

/** Single-deal guard for the deal detail page. */
export async function canSeeDeal(session: SessionPayload, deal: Deal): Promise<boolean> {
  return isNameAllowed(await allowedAgentNames(session), deal.agentName);
}
