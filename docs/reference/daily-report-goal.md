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

**Maps to app today:** sections 1 & 3 are mostly buildable from existing
`AgentLedgerEntry` / `Deal` / `Billing` / `Income`. **Missing:** (a) non-agent
office expenses — every ledger entry currently requires an agentId; need an
`OfficeExpense` type or make agentId optional + add a category; (b) bank
tracking — need `BankTransaction` + daily `BankBalance`, best fed by importing
the bank's CSV/OFX rather than typing.

**Suggested sequencing:** 1) agent picker ([[deals-identity-gap]]), 2)
OfficeExpense + admin form (quick win, covers the "A/C repair" case), 3)
`/daily-report?date=` route rendering sections 1+3, 4) bank import + section 2.

See [[reference-paths]] for file locations.
