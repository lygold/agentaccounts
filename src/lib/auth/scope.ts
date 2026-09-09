import "server-only";
import type { SessionPayload } from "./session";
import { isManager } from "./session-cookie";
import { listAgentNamesInTeam } from "../monday/agents";
import type { Deal } from "../types";

/**
 * The set of agent *names* a session is allowed to see data for — used to
 * scope both the deals list and the per-agent ledger:
 *   - manager / admin : everyone  → returns "all"
 *   - team_leader      : themselves + every agent on the same team
 *   - agent            : themselves only
 *
 * KNOWN LIMITATION — deals and ledger entries created before the Phase 4c
 * agent picker carry a *typed* agentName as their identity, not an agent id.
 * So matching here is by name string, not id. Once the picker lands (real
 * agentId + denormalised team) this switches to id matching.
 */
export async function allowedAgentNames(
  session: SessionPayload,
): Promise<Set<string> | "all"> {
  if (isManager(session)) return "all";

  const names = new Set<string>([session.agentName]);
  if (session.role === "team_leader" && session.team != null) {
    for (const n of await listAgentNamesInTeam(session.team)) {
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
