---
name: role-scoping
description: "How the dashboard, deals list, and per-agent ledger are gated by role"
metadata: 
  node_type: memory
  type: project
  originSessionId: 6609ff1d-e85f-4c01-9fbc-2bcbb4bf3dee
  modified: 2026-09-02T12:17:03.774Z
---

Added 2026-08-31. Roles: `agent` | `team_leader` | `manager` | `admin`
(`src/lib/monday/types.ts`). "Managers" = `manager` + `admin`
(`MANAGER_ROLES` / `isManager()` in `src/lib/auth/session-cookie.ts`).

Scoping helper: `src/lib/auth/scope.ts` — `allowedAgentNames(session)` returns
`"all"` for managers, else a `Set` of agent names (own name always included;
team leaders add their רובע/district roster via Monday).

| Route | agent | team_leader | manager/admin |
|---|---|---|---|
| `/` dashboard (all agent balances) | redirected to own ledger | redirected to own ledger | full view |
| `/deals` + `/deals/[id]` | own deals only, VIEW ONLY | own + same-district, VIEW ONLY | all + all write actions |
| `/agents/[agentId]` ledger | own only, VIEW ONLY | own + district, VIEW ONLY | anyone + Add-entry form |
| `/deals/new` | redirected to /deals | redirected to /deals | full |

**Write actions are manager-only** (added 2026-09-02): `requireManager()` helper
in session-cookie.ts (throws "FORBIDDEN" for non-managers). Gates every action in
`deals/actions.ts` (submitNewDeal, submitIncome, GI client/300/receipt actions) and
`agents/[agentId]/actions.ts` submitLedgerEntry. Pages hide the forms via
`canEdit = isManager(session)`. Agents/team-leaders are strictly read-only.

Nav (`src/components/nav.tsx`): managers see "Dashboard" link; everyone else
sees "My ledger" → `/agents/{session.agentId}`.

A team leader is also an individual agent — handled by always seeding the
allowed-set with their own name, so one list shows their deals + their team's.

Matching is by name string, not id — see [[deals-identity-gap]] for why and the
planned fix.

Nav gotcha (fixed 2026-09-02): `LocaleToggle` is `position:fixed top-3 right-3
z-50` (in layout.tsx, shows on login pages too). The Nav's trailing item —
"Sign out" in LTR/English, the links in RTL/Hebrew — rendered *under* it and
looked missing. Fixed with `pr-24` on the `<nav>`. Verified in-app as David
Weiser (team_leader): sign out visible, his 14 imported deals + ₪23,286 ledger
balance render correctly.
