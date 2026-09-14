---
name: daily-report-goal
description: "The daily accounting report the app should eventually auto-generate, and the manual cash-flow Excel it should replace"
metadata: 
  node_type: memory
  type: project
  originSessionId: 6609ff1d-e85f-4c01-9fbc-2bcbb4bf3dee
  modified: 2026-08-31T12:11:52.043Z
---

Levi manually produces a **daily accounting report** (PDF, one per day) and
separately hand-maintains a **cash-flow Excel**. The app's long-term goal is to
generate the report automatically and kill the manual Excel entry.

**The daily report PDF has 3 stacked sections:**
1. Agent table — every agent with הוצאות / הכנסות / יתרה תזרימית (expense /
   income / cash balance), plus interleaved "waiting for chesbonit" rows for
   deals not yet invoiced. Bottom totals row.
2. בנק — one-line bank snapshot: balance as of prior day, standing-order
   debits (הורא.קבע), credits.
3. רימקס ישראל — payments received from RE/MAX Israel: office, client,
   RE/MAX-Israel gross, amount we received, invoice #, agent, notes.

**Cash-flow Excel** (`copy תזרים מוזמנים 2026.xlsx`, sheet תזרים מוזמנים): a
full bank-account reconciliation — one column block per month (Jan = B–L,
Feb = O–Y, ...), every bank line: CC fees, עיריית ירושלים, cleaning service,
keren hishtalmut/pension, loan principal+interest, client payments in, agent
payouts, referral fees both directions, running balance per day.

**Built (2026-09-14, ROADMAP Phase 7, commit `a6d73f9`):** all three sections
live at `/reports/daily?date=`. `OfficeExpense`, `BankTransaction`,
`BankBalance`, `RemaxIsraelReceipt` types + tables; entry forms on
`/admin/finance`. Bank import is **paste**, not CSV/OFX-automatic — Levi
copies the Bank Leumi "תנועות בחשבון" export rows in (see
[[bank-export-format]]). **Verified**: the agent-table balance calc reproduces
David Weiser's reconciled ₪23,286.36 exactly against the real ledger.

**Not yet built:** the full per-deal payment-lifecycle strip (invoice
requested / חשבונית מס uploaded / Ariyel paid / קבלה uploaded) — needs a
`Deal` lifecycle field; today's report interleaves `due`/`partial_payment`
deals as a plainer proxy. Also: Ariyel's "payments to make" checklist view,
PDF export, WhatsApp notifications (ROADMAP Phase 7's WABA handoff list).

See [[reference-paths]] for file locations.
