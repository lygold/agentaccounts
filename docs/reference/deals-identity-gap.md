---
name: deals-identity-gap
description: "Deal/ledger agent identity — was a typed name string, now the agents-table id (closed in Phase 4c). Residuals noted here."
metadata: 
  node_type: memory
  type: project
  originSessionId: 6609ff1d-e85f-4c01-9fbc-2bcbb4bf3dee
  modified: 2026-09-10
---

**Status: closed in Phase 4c (`249cf0e`).** Kept as the record of what changed
and what residue remains.

## The gap (pre-Phase 4c)

The "New deal" form stored a **free-typed agent name** as the deal's identity
(`agentId === agentName`), while the session carried the Daf Kesher pulse id.
They didn't match, so role scoping ([[role-scoping]]) had to compare **name
strings**, team-leader scoping did a Monday district lookup on every
deals-page load, and deals had no team field so membership couldn't be
resolved from the deal alone.

## How it works now (Phase 4c)

- `/deals/new` has an **agent picker** — a `<select>` of the office's active
  agents (`submitNewDeal` in `src/app/deals/actions.ts`). No free-text name.
- `submitNewDeal` resolves the picked id against the `agents` table, checks
  `officeId` + `status === "active"`, then stamps `agentId` (`agt_<uuid>`),
  `agentName` (snapshot), and `team` (snapshot) onto the `Deal`.
- `Deal.team` exists (`src/lib/types.ts`) — denormalised so team-leader
  scoping needs no roster lookup at read time.
- `src/lib/auth/scope.ts` is **id-based**: `allowedAgentIds` /
  `isIdAllowed` / `filterDealsByIds` / `canSeeDeal`. Team-leader roster comes
  from `listAgentIdsInTeam` (agents table, `byOfficeId` GSI) — no Monday call.
- `src/lib/monday/agents.ts` was **deleted**; nothing in the app reads Monday
  for identity anymore.
- `form-parse.ts` `DealSchema` takes `agentId`, not `agentName`.

## Migration of pre-Phase-4 rows

- `scripts/migrate-deal-agent-ids.mjs` — repoints `agentId` on
  `agent-ledger-deals` from the Monday pulse id to the `agt_` id, using the
  `agents` table's `mondayItemId → id` map. Idempotent; billing/income carry
  no agent ref. Run after `import-agents-from-monday.mjs --write`.
- `scripts/backfill-deal-team.mjs` — set `team` on the 14 existing rows (all
  team 3).
- Old `agent-ledger-ledger-entries` (67 Weiser rows) was **not** handled by
  the migration — repopulated via `import-weiser.mjs` against the new agent id.

## Residuals

- A deal that still carries a bare name in `agentId` (unmigrated / an agent
  with no `mondayItemId`) simply **won't match for a non-manager** — managers
  see all, so it's invisible rather than broken. Re-run the migration if one
  surfaces.
- Write actions in `deals/actions.ts` (`submitIncome`, GI client/300/receipt
  actions) are now gated by `requireManager()` — the "still ungated" note here
  is resolved. There is still **no per-deal ownership check** finer than
  manager (a manager can act on any deal in scope); that's by design.
- Office scoping of deal *reads* (`listDeals()` is a table scan) is still open
  — ROADMAP Phase 5.
