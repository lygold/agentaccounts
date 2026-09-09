---
name: commission-auto
description: How agent commission is auto-calculated and posted when a deal payment is logged
metadata: 
  node_type: memory
  type: project
  originSessionId: 6609ff1d-e85f-4c01-9fbc-2bcbb4bf3dee
  modified: 2026-09-02T12:42:42.613Z
---

Built 2026-09-02. Replaced the manual "post commission" form (`postCommission`
action + its UI — both deleted) with automatic posting.

**Flow:** manager logs a payment on a deal (`submitIncome` in
`deals/actions.ts`) → `createIncome` → `commissionForPayment(deal, income)`
(`src/lib/commission-auto.ts`) → if > 0, auto-creates a `commission` ledger
entry for the deal's agent, dated the payment's receivedDate, linked to the deal.

**The math** (`src/lib/commission-auto.ts` + `commission.ts`
`computeMarginalCommission`, bracket-blended like income tax):
- `recognisedDealValue(deal, payAmount)` = payAmount / billedInclVat × `computeDealValue`
  (pre-VAT, referral-subtracted).
- `priorYtdDealValue(agentId, beforeDate)` = Σ recognisedDealValue over the
  agent's deals' income rows received earlier the same calendar year
  (`listDealsByAgent` → `listIncomeForDeal`).
- commission = marginal commission on this payment's recognised value, starting
  the tier cursor at priorYtd.

**Tier tables** — `src/lib/commission-tiers.ts`, from the `חלוקת עמלות` sheet in
`חלוקת חדש 2026.xlsx`. Cumulative pre-VAT YTD thresholds **0 / 450k / 650k**
(the sheet's "1000000" column is the 650k+ rate). Standard = [0.5, 0.55, 0.6];
flat 0.6 for אורנה אבן פרקר / עליזה פרידלנד / רחל גליק. Keyed by Daf Kesher id
(only דוד וייזר 1593093187 resolved so far) with a name fallback. Verified
against commission.ts's worked example (440k YTD + 20k deal → 10500 = 52.5%).

Deal detail page shows a read-only "Agent commission" section: blended rate +
total posted to ledger for that deal — **pre-VAT** (e.g. הולצברג: 60.0% / ₪18,900,
not ₪22,302).

**VAT (added 2026-09-02, per Levi "both"):** every `AgentLedgerEntry` carries
BOTH `amount` (VAT-inclusive — the cash figure, what `runningBalance` and the
daily-report יתירה תזרימית sum) and `amountExVat` (pre-VAT — what the agent
actually earns, what commission tiers accumulate). `stripVat`/`addVat` in
commission.ts (VAT_RATE 0.18). `createLedgerEntry` derives `amountExVat` via
stripVat when a caller omits it; commission auto-post passes both explicitly
(engine returns pre-VAT, ×1.18 for the cash side). `entryExVat(e)` helper
tolerates pre-field rows. Agent ledger page shows both per row + both balances.
David's balance: ₪23,286.36 incl / ₪19,734.20 excl.
The `data` sheet's `סכום` column is VAT-inclusive throughout; `בלי מעמ` is
pre-VAT basis (not always the agent's share — use K/1.18, which the import does).

**Not done:** commission-tiers is a config module, not a DynamoDB table (fine —
changes yearly). Gold club (מועדון הזהב) and quarterly targets not modelled.
Recurring monthly expenses (`agents and recurring expenses` sheet: משרד/מדלן/
פרמי) not auto-posted yet. See [[weiser-import]] — that import used the sheet's
real historical figures, not this engine.
