---
name: deals-identity-gap
description: "Deals and ledger entries store a typed agent name, not a Monday pulse ID — blocks exact role scoping"
metadata: 
  node_type: memory
  type: project
  originSessionId: 6609ff1d-e85f-4c01-9fbc-2bcbb4bf3dee
  modified: 2026-08-31T12:12:01.933Z
---

The "New deal" form (`src/app/deals/actions.ts` `submitNewDeal`) stores a
**free-typed agent name** as the deal's identity: `agentId === agentName`. Same
for some `AgentLedgerEntry` rows. Meanwhile the session carries the real Daf
Kesher pulse id as `session.agentId` and the display name as
`session.agentName`. They don't match.

Consequences:
- Role scoping ([[role-scoping]]) has to match by **name string**, which is
  fragile if the typed name ≠ the Daf Kesher `name`.
- Team-leader scoping does a Monday lookup of same-district agent names on
  every deals-page load (`listAgentNamesInDistrict` in `src/lib/monday/agents.ts`).
- Deals have no `district` field, so team membership can't be resolved from
  the deal alone.

**The fix (TODO(phase-3), referenced in deals/actions.ts):** add an agent
picker to deal creation that selects the agent from Daf Kesher, stores the real
`agentId`, and snapshots their `district` onto the `Deal`. Then scoping is exact
id/district match — no Monday call, no name fragility. Also lets `/deals/new`
stop accepting an arbitrary typed name.

**Also still ungated (write side):** deal server actions (`submitIncome`,
`postCommission`, `createReceiptForIncome`, ...) only call `requireSession()`,
not a deal-ownership check. They're effectively manager ops and should be
gated or moved behind the manager role.
