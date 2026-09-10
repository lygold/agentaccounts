---
name: role-scoping
description: "How the dashboard, deals list, per-agent ledger, and admin surfaces are gated by role"
metadata: 
  node_type: memory
  type: project
  originSessionId: 6609ff1d-e85f-4c01-9fbc-2bcbb4bf3dee
  modified: 2026-09-10
---

Roles: `agent` | `team_leader` | `manager` | `admin` (`AppRole` in
`src/lib/monday/types.ts`). "Managers" = `manager` + `admin`
(`MANAGER_ROLES` / `isManager()` in `src/lib/auth/session-cookie.ts`);
`isAdmin()` is admin-only.

Guards in `session-cookie.ts`: `requireSession()` (any logged-in),
`requireManager()` (throws `FORBIDDEN` otherwise), `requireAdmin()`
(admin only).

## Read scoping — `src/lib/auth/scope.ts` (id-based since Phase 4c)

`allowedAgentIds(session)` → `"all"` for managers, else a `Set<string>` of
**agent-table ids** (`agt_…`): own id always, plus — for a team leader with a
`session.team` — every id on that team via `listAgentIdsInTeam(officeId,
team)` (agents table, `byOfficeId` GSI; includes archived). No Monday call.
Helpers: `isIdAllowed`, `filterDealsByIds`, `canSeeDeal`.

Matching is by `deal.agentId` === agents-table id. Deals are created with the
real id via the `/deals/new` agent picker; pre-Phase-4 rows were migrated
(`scripts/migrate-deal-agent-ids.mjs`). A row still carrying a bare name just
won't match for a non-manager. See [[deals-identity-gap]].

| Route | agent | team_leader | manager/admin |
|---|---|---|---|
| `/` dashboard (all agent balances) | → own ledger | → own ledger | full view |
| `/deals` + `/deals/[id]` | own deals, VIEW ONLY | own + same-team, VIEW ONLY | all + all write actions |
| `/agents/[agentId]` ledger | own only, VIEW ONLY | own + team, VIEW ONLY | anyone + Add-entry form |
| `/deals/new` | → /deals | → /deals | full (agent picker) |
| `/admin/agents` + `/admin/agents/[id]` | → / | → / | **admin only** (`isAdmin`, else redirect `/`) |

## Write scoping

All write actions are **manager-only** (`requireManager()`):
`deals/actions.ts` — `submitNewDeal`, `submitIncome`,
`searchGreenInvoiceClientForDeal`, `confirmGreenInvoiceClient`,
`createTransactionAccountForDeal`, `createReceiptForIncome`;
`agents/[agentId]/actions.ts` — `submitLedgerEntry`.
Pages hide the forms via `canEdit = isManager(session)`.

Agent management (`admin/agents/actions.ts` — `createAgentAction`,
`updateAgentAction`, `setAgentStatusAction`, `syncFromMondayAction`) is
**admin-only** (`requireAdmin()`). As of 2026-09-10 the mutating actions
fetch the target and check `officeId === session.officeId` **before** the
write (the store's `updateAgent` is a blind put by id) — a direct POST can't
mutate another office's row. `createAgentAction` stamps `session.officeId`.

## Nav (`src/components/nav.tsx`)

Managers see "Dashboard"; everyone else sees "My ledger" →
`/agents/{session.agentId}`. Admins additionally see "Agents" →
`/admin/agents`. A team leader is also an agent — the allowed-set is always
seeded with their own id, so one list shows their deals + their team's.

Nav gotcha (fixed 2026-09-02): `LocaleToggle` is `position:fixed top-3
right-3 z-50` (layout.tsx, shows on login pages too). The Nav's trailing item
rendered *under* it; fixed with `pr-24` on the `<nav>`.

## Known-open (ROADMAP Phase 5)

Reads are **not office-scoped**: `listDeals()` / `listAgentBalances()` are
table scans, so a manager's "all" spans every office. The per-agent ledger
page doesn't check the agent's `officeId`. Fine while there's one office;
Phase 5 adds `byOfficeId` queries + a store-layer write assertion.
