---
name: weiser-import
description: "The David Weiser 2026 data-migration into DynamoDB — sources, mapping, scripts, and the payment_by_agent type it added"
metadata: 
  node_type: memory
  type: project
  originSessionId: 6609ff1d-e85f-4c01-9fbc-2bcbb4bf3dee
  modified: 2026-09-02T12:42:49.914Z
---

Built 2026-09-02. First real data loaded into the app — David Weiser (דוד וייזר),
Daf Kesher id **1593093187**, רובע 3, team leader.

**The real ledger source is `חלוקת חדש 2026.xlsx`** (in `…/Remax Vision/accounting/2026/`),
sheet **`data`** — header row 5: תאריך / סוכן / תיאור / כתובת / הפעולה / סוג /
עלות / בלי מעמ / כמות / אחוז חלקוה / סכום / מס חשבונית. Column `סוג` has 4
values: income / expense / payment to agent / paid by agent. That workbook also
has a `Daily Report` sheet (exact layout of the daily PDF), a `summary per
agent` sheet, and a `חלוקת עמלות` sheet = per-agent commission tier table
(thresholds 450k/650k/1M + מועדון הזהב). The `copy תזרים מוזמנים 2026.xlsx` on
D: is a *different*, broader thing (full bank reconciliation) — not the agent ledger.

**Reconciliation that confirmed the model:** David's 67 `data` rows net to
**+₪23,286.36** = exactly his `יתירה תזרימית` on the 30/08/2026 daily report.
Sign convention: balance = Σcommission − Σexpense − Σpayment_to_agent + Σpayment_by_agent.

**New ledger type added:** `AgentLedgerEntryType` gained `payment_by_agent`
(agent settled their own expense tab → positive/credit). Touched types.ts,
form-parse.ts, agents/[agentId]/actions.ts (sign logic), agents/[agentId]/page.tsx
(select), en/he.json. commission = +K, expense = −K, payment_to_agent = −K,
payment_by_agent = +K.

**Scripts (app/scripts/):**
- `build-weiser-data.py` — resolves Red File (board 1816827169, 14 in-scope 2026
  deals embedded as a constant) + the `data` sheet → `weiser-import-data.json`.
  Red File item → Deal + Billing (price×pct%×1.18) + Income (Paid subitems);
  `data` rows → 67 AgentLedgerEntry. 2-sided deals kept as 2 Deal records.
  Referral-side (הפניה) deals shoehorned to side=seller + note. Re-runnable.
- `import-weiser.mjs` — reads the JSON, PutItem with `attribute_not_exists(id)`
  guard (idempotent, never updates/deletes). DRY RUN by default;
  `--write` to apply. Deterministic ids: weiser-… / bill-… / inc-… / led-w-….
  Run: `node --env-file=.env.local scripts/import-weiser.mjs [--write]`

Status (2026-09-10): **the 67 ledger rows are NOT in the live DB.** They went
into the old `agent-ledger-ledger-entries` table; the 2026-09-06 rename to
`agent-ledger-agent-account` left the new table empty, so David's balance and
the manager dashboard read ₪0 in prod. deals (14) / billing (14) / income (16)
are fine and the 14 deals were migrated to his `agt_` id. The JSON's 67
`ledgerEntries` were repointed `1593093187 → agt_2b51d344-088c-416f-a4f9-c5cbea6617ba`;
`deals` in the JSON left on the old id (already imported+migrated, don't re-touch).
Backfill: `node --env-file=.env.local scripts/import-weiser.mjs --write` (plain
guard is fine — only the 67 missing rows insert). The JSON already carries
`amountExVat` on every ledger entry, so no `--overwrite` needed.

Also there's now a "New deal" button on the agents'
`/deals` page → external intake form (DEAL_INTAKE_URL in office.ts,
https://main.d398ynovmjstlh.amplifyapp.com/); managers still get internal /deals/new.
Not yet done: commission-tier config not imported (no DynamoDB table for it);
`postCommission` tier engine is for future deals, this import used real historical figures.
