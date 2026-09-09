---
name: agent-hub-plan
description: "The approved program plan to merge sikkumPigisha into agentLedger as one agent hub — decisions, phases, open questions"
metadata: 
  node_type: memory
  type: project
  originSessionId: 6609ff1d-e85f-4c01-9fbc-2bcbb4bf3dee
  modified: 2026-09-06T10:48:09.734Z
---

Approved 2026-09-03. Full plan: `C:\Users\Levi\.claude\plans\pdf-fidelity-doesnt-flickering-hartmanis.md`
Artifact (shareable): https://claude.ai/code/artifact/c9742cfc-4618-47f9-a991-1f0f26f4dd9e

**Vision:** one app agents open for everything — standing (owed/owing, client
paid?, Ariyel paid me?), upload receipts, deal notes, submit deals (the
summary-of-terms wizard), add/update properties. Managers: billing, income,
daily report. agentLedger is the base; sikkumPigisha's wizard moves in;
sikkumPigisha retired. Monday = 2-way sync **migration bridge**, archived in months.

**Decisions locked:**
- Monday: migration bridge (not permanent, not one-way).
- Hub is NOT a signing platform — it ingests **emailed copies** of signed
  forms (haskama/biladiut/buyer-rep), Claude-parses them, Levi confirms, matches to deals.
- Pipeline = **linked entities** (Signed Contract ⇄ Property ⇄ Offer ⇄ Deal),
  each own status, **propagation rules both ways** (e.g. offer accepted →
  property "In Negotiation"; deal signed → property "Signed").
- Agent expenses: expense rows (recurring auto / manual) → hub sends agent a
  חשבון עסקה via GI API → Levi charges card in GI → **webhook → payment_by_agent (paid)**.
- Summary-of-terms PDF: keep Make.com during bridge, rebuild in-app at Monday retirement.
- Contact entity: deferred (Signed Contract is the unit for now).
- Ariyel = admin role (reports + Levi's full backup). Secretary tooling = future.
- Deploy: new Amplify app, raw URL, same AWS acct. Backfill 2026-forward for now.

**Cross-cutting:** service layer `src/lib/services/*` (every business op a plain
fn; web actions + future WhatsApp bot are thin callers). DynamoDB = source of
truth from Phase 1. Mirror writes never block the user (dead-letter + resync).
Design deferred — functionality first.

**New DynamoDB tables:** `signed-contracts`, `properties`, `offers`, `referrals`,
`deal-notes` (GSI byDealId), `gi-documents` (GSI byDealId + byGiClientId, tracks
every 300/305/320/400 with its target: deal or agent-expenses). Extend `deals`
(+mondayItemId, wizard rich fields, signedContractId/offerId/propertyId,
pdfStatus, payment lifecycle owed→invoice_requested→payable→paid→receipted),
`income` (+source app|webhook|manual, +greenInvoiceDocId, +attachmentKey).

**Deploy prep (2026-09-06):** repo is `github.com/lygold/agentaccounts` (=
contents of `D:\Dev\agentLedger\app`, `.git` is in `app/`). Deploying to a
new Amplify Hosting app "agentaccounts", Git-connected. `dynamo-client.ts`
updated: uses static keys locally, compute-role creds on Amplify (skips
explicit creds when `AWS_SESSION_TOKEN` present); `DYNAMO_REGION` fallback
added. AWS keys NOT set on Amplify — grant the compute role a
DynamoDB(`agent-ledger-*`) + S3(`agent-ledger-attachments`) policy instead
(acct 204529129418). `agent-ledger-ledger-entries` renamed →
`agent-ledger-agent-account` (env `DYNAMODB_TABLE_AGENT_ACCOUNT`); it's now
in `create-tables.mjs` — Levi runs that + re-runs `import-weiser.mjs --write`
+ deletes the old table. Session work committed + pushed 2026-09-06 — `4537b23` on main
(role-based access, VAT ledger, auto-commission, service layer, Phase 0 prep).
Weiser migration files (`scripts/*weiser*`) gitignored (real client data).
Remaining Phase 0: run `create-tables.mjs` + re-run `import-weiser.mjs --write`
(agent-account table doesn't exist yet); finish Amplify IAM compute role;
set env/secrets; delete old `agent-ledger-ledger-entries` once verified.

**Phase 0 progress (2026-09-04):** service layer built — `src/lib/services/`
`deals.ts` (createDealWithBilling, resolveGiClientForDeal, setGiClientForDeal,
createDealTransactionAccount, createIncomeReceipt), `payments.ts`
(recordDealPayment = income + auto-commission), `ledger.ts`
(addManualLedgerEntry, sign rules). `deals/actions.ts` + `agents/[agentId]/actions.ts`
now thin callers (auth + FormData + redirect only). tsc/lint/build green.
Table-creation script: `scripts/create-tables.mjs` (6 new tables, PAY_PER_REQUEST,
run with ADMIN creds not the scoped app user) — Levi to run. Still Levi's:
new Amplify app + prod SESSION_SECRET + move creds; Google Drive service account.

**Phases:** 0 foundations+deploy+service layer · 1 dual-write bridge + backfill ·
2 merge wizard, retire sikkum · 3 GI income+expense engine (webhook) · 4 pipeline
entities + propagation + signed-form email ingestion + property form + notes ·
5 daily report + agent standing + WhatsApp notifications · 6 Monday retirement +
in-app PDF. Later: WhatsApp-first, design pass, secretary ad tools, Contact
layer, bank-CSV cash flow, agent self-sign + fraud gate.

**OPEN (need Levi / external):**
- RE/MAX Israel receipts — money path (client → RE/MAX Israel → office; invoices
  ~221xxx outside office GI). Assume manual entry form for now.
- Signed-form email parsing — which forms, which addresses, how structured; are
  the 3 signing programs' Make scenarios shareable (structured POST vs parse).
- Offers Google Form (forms.gle/D1XK8vxst8R7dsN2A) + its Make scenarios — Levi to share.
- Per-deal payment lifecycle states — confirm; what Levi keys on payment entry.
- Notification list + RE/MAX-brand wording per handoff.
- GI webhooks available on the plan? event/payload shape (else poll fallback).
- mirrorIn transport: Monday webhooks vs scheduled poll.

**Context:** sikkumPigisha D:\Dev\sikkumPigisha, deployed main.d398ynovmjstlh.amplifyapp.com,
wizard 18 steps (draft in Redis, `wizard.ts`/`draft.ts`/`validation.ts`), writes
Deals_Raw_Data (board 1946512255) → Make → Red File (1816827169). Make PDF watches
Deals_Raw_Data pdfStatus. Boards: Signed Contracts 1623367406 (927 items,
haskama/biladiut, Landlord/Seller/Renter/Buyer/SHATAP, exclusivity dates),
Properties Raw Data 1633691694 (309, Listing Status Active→In Negotiation→Signed→Paid),
הצעת מחיר offers 1975354909, Referrals 5092845827, Daf Kesher 1593085910 (identity, stays).
Incoming Leads migrating to a different system — not into the hub.
