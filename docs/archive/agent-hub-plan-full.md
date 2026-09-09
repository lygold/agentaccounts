# The Agent Hub — program plan

## Context

RE/MAX Jerusalem's deal workflow is spread across several tools: **agentLedger**
(this repo — commissions, deals, agent balances, on DynamoDB + a 4-role
permission system), **sikkumPigisha** (`D:\Dev\sikkumPigisha`, deployed — an
18-step "summary of terms" wizard that writes Monday), a set of Monday boards
that act as the database, three external client-signing programs, Green Invoice,
and two manually-maintained Excel workbooks.

The goal: **one app agents open for everything** — see their standing (owed /
owing, has the client paid, has Ariyel paid me), upload receipts, add notes to
deals, submit new deals via the summary-of-terms form, add and update
properties. Managers additionally run billing, income, and the daily report.

agentLedger is the base to build on (it has the data layer, roles, and ledger).
sikkumPigisha's wizard moves in; sikkumPigisha is retired. Monday is kept in
2-way sync as a **migration bridge** and archived within months. The hub is NOT
a digital signing platform — it ingests copies of already-signed forms.

Everything below is phased. Each phase is independently shippable and leaves the
app working. Design polish is deliberately deferred — functionality first.

---

## Status (2026-09-07)

**Phase 0 — mid-flight.** Committed + pushed to `lygold/agentaccounts` main:
role-based access, VAT-aware ledger, auto-commission, the service layer,
`dynamo-client.ts` compute-role credentials, table rename
(`agent-ledger-agent-account`), `scripts/create-tables.mjs` + `check-tables.mjs`,
Node 22 pin, and **`amplify.yml`** (writes env vars into `.env.production` at
build time — Amplify SSR doesn't expose console env vars to the runtime
otherwise; sikkumPigisha's `amplify.yml` is the reference for this).

Remaining Phase 0 (Levi): confirm the Amplify build from the amplify.yml commit
is green, run `create-tables.mjs` + re-run `import-weiser.mjs --write`, confirm
the IAM compute role is attached, fill real secret values in Amplify, log in and
verify the dashboard + David Weiser's ledger. Then delete the old
`agent-ledger-ledger-entries` table.

---

## Decisions locked (from Levi)

| Topic | Decision |
|---|---|
| Monday's future | **Migration bridge** — 2-way sync now, boards archived in months |
| Client signing | Hub does **not** sign clients. It receives **emailed copies** of signed forms, parses them, and matches them to deals |
| Pipeline status | **Linked entities** (Signed Contract ⇄ Property ⇄ Offer ⇄ Deal), each with its own status, with **propagation rules** both directions |
| Agent expenses | Expense rows added (recurring auto / manual) → hub sends the agent a חשבון עסקה via GI API → Levi charges the card in GI → **webhook marks the expense paid** (`payment_by_agent`) |
| Signed-form ingestion | **Email → hub parses** (Claude extract), Levi confirms/fixes |
| RE/MAX Israel receipts | Source unclear — see Open Questions; assume manual entry for now |
| Summary-of-terms PDF | **Keep the Make.com scenario** during the bridge; rebuild in-app when Monday is retired |
| Contact entity | Deferred — start with Signed Contract as the unit; add a deduplicated Contact layer in a later phase |
| Ledger amounts | Every entry already carries `amount` (VAT-incl, cash) + `amountExVat` (pre-VAT) — see `src/lib/store/agent-ledger.ts`, `commission.ts` (`stripVat`/`addVat`) |
| Commission | Auto-posted on income, bracket-blended per YTD tier — `src/lib/commission-auto.ts`, `commission-tiers.ts` (already built) |
| Doc storage | S3 as source of truth + auto-copy into the accounting Google Drive folder |
| Deploy | New Amplify app, raw Amplify URL for now, same AWS account (`eu-north-1`) |
| Backfill | 2026-forward for now; full historical backfill is a later phase |
| PDF fidelity | "Pretty similar" is fine — a clean rebuild, not byte-identical |

---

## Cross-cutting principles

1. **Service layer.** Every business operation (`createDeal`, `logPayment`,
   `addNote`, `billAgentExpenses`, `markDealSigned`, …) is a plain async
   function in `src/lib/services/*`. Server actions and the future WhatsApp
   handler are both thin callers. Refactor the existing actions
   (`src/app/deals/actions.ts`, `src/app/agents/[agentId]/actions.ts`) to
   delegate. This is what makes "manage the whole thing over WhatsApp" a
   later add-on, not a rewrite.
2. **DynamoDB is the source of truth** from Phase 1 on. Monday is a mirror.
3. **Mirror writes never block the user** — fire-and-forget, dead-letter log,
   a manager "resync to Monday" action.
4. **Roles** (`src/lib/monday/types.ts`): agent / team_leader / manager / admin.
   Ariyel = **admin** (reports + full manager capability as Levi's backup).
   Secretary tooling is a future phase.
5. **Reuse, don't rebuild.** sikkumPigisha and agentLedger already carry
   near-identical `auth/`, `monday/client.ts`, `commission.ts`, `waba/client.ts`,
   `redis.ts`, `locale-toggle`, and shadcn primitives. agentLedger's copies win
   (they have the role system); sikkumPigisha's extra pieces move over.

---

## Entity model (new DynamoDB tables)

All carry `officeId`. Naming/patterns follow `src/lib/store/*` and
`src/lib/store/dynamo-store.ts` (`getById`, `insert`, `update`, `queryByIndex`).

| Table | Holds | Key / GSI |
|---|---|---|
| `signed-contracts` | Parsed copy of a haskama / biladiut / buyer-rep form: client name(s) + ID, side (seller/landlord/buyer/renter/SHATAP), contract type (haskama/biladiut), property address, commission terms, signed date, exclusivity start/end, PDF `s3Key` | `id` · GSI `byAgentId` |
| `properties` | Listing — mirror of Properties Raw Data + hub-added. Address, gush/chelka, price, rooms/size, photos, listing status, secretary publish-status, link to the seller's signed contract | `id` · GSI `byAgentId` |
| `offers` | הצעת מחיר — buyer(s), property, price, payment terms, transfer dates, signature files, status (follow-up / accepted / rejected / duplicate) | `id` · GSI `byAgentId` |
| `referrals` | Incoming/outgoing referral — referring agent/office, contact, % of commission, linked deal/contract | `id` · GSI `byDealId` |
| `deal-notes` | Append-only. One row per note: `dealId, authorId, authorName, body, createdAt` | `id` · GSI `byDealId` |
| `gi-documents` | Every Green Invoice doc the hub knows about (300/305/320/400): GI id, type, GI client id, amount, **target** (`{kind:"deal", dealId}` or `{kind:"agent-expenses", agentId, expenseEntryIds:[]}`), linked-300 id, PDF `s3Key` | `id` · GSI `byDealId`, GSI `byGiClientId` |

Extend existing:
- `deals` (`src/lib/types.ts`): + `mondayItemId`, the wizard's rich fields
  (parties, lawyers, per-side commission terms, communication language,
  `otherSideRepresentedBy`), `signedContractId`, `offerId`, `propertyId`,
  `pdfStatus`, per-deal **payment lifecycle** (`owed → invoice_requested →
  payable → paid → receipted`).
- `income`: + `source: "app" | "webhook" | "manual"`, `greenInvoiceDocId`,
  `attachmentKey`.
- `AgentLedgerEntry`: + `attachments` already typed
  (`AgentLedgerAttachment[]` in `types.ts`) — wire it for the agent's
  חשבונית מס + קבלה on `payment_to_agent`, and for expense docs.

---

## Phases

### Phase 0 — Foundations & deploy
Goal: agentLedger is deployable and has room for the new work. No UX change.

- [x] New Amplify app (`agentaccounts`, Git-connected to `lygold/agentaccounts`).
- [x] **`amplify.yml`** — writes the app's env vars into `.env.production` in the
  build so the Next.js SSR runtime actually sees them (Amplify Hosting does not
  expose console env vars to SSR otherwise). Reference: `sikkumPigisha/app/amplify.yml`.
  Also pins Node 22. **This was the deploy blocker.**
- [x] `dynamo-client.ts` — Amplify compute-role credentials at runtime (skips
  explicit creds when `AWS_SESSION_TOKEN` present), static keys locally,
  `DYNAMO_REGION` fallback.
- [x] `src/lib/services/{deals,payments,ledger}.ts` — business logic extracted,
  actions are thin callers.
- [x] `scripts/create-tables.mjs` (6 new tables + `agent-ledger-agent-account`,
  the renamed ledger table), `scripts/check-tables.mjs`.
- [ ] Run `create-tables.mjs` + re-run `import-weiser.mjs --write` (Levi, admin creds).
- [ ] IAM compute role `agent-ledger-hub-compute` attached + deployed.
- [ ] Real secret values in Amplify (SESSION_SECRET fresh); verify login + dashboard.
- [ ] `pushToDrive(s3Key, driveFolder)` helper stub + Drive service account — deferred to Phase 3.

**Ships:** agentLedger live at the Amplify URL, feature-identical to today.

### Phase 1 — Dual-write bridge
Goal: DynamoDB becomes the read source; Monday stays current automatically.

- `src/lib/sync/` — `mirrorOut(entity)` maps a hub record to its Monday board
  columns and upserts (reuse `src/lib/monday/columns.ts` conventions, and
  sikkumPigisha's `buildColumnValues` in `monday/deals.ts` for the deal shape).
  Fire-and-forget, dead-letter list in Redis, `resyncEntity` admin action.
- `mirrorIn` — a scheduled poll (Amplify scheduled function) diffs each Monday
  board's recently-updated items into DynamoDB, so changes the secretary /
  Ariyel make in Monday during the bridge reach the hub. (Monday webhooks if
  simpler.)
- Backfill scripts (2026-forward) — generalise `app/scripts/build-weiser-data.py`
  + `import-weiser.mjs` to pull Red File, Signed Contracts, Properties, Offers
  into DynamoDB.
- New tables from the entity model above (Contact layer excluded).
- Flip all hub reads to DynamoDB.

**Ships:** every hub read served from AWS; Monday mirrors both ways.

### Phase 2 — Merge the wizard
Goal: deal intake lives in the hub. sikkumPigisha retired.

- Move `sikkumPigisha/app/src/app/form/(wizard)/*` →
  `app/src/app/deals/new/(wizard)/*`; rewire imports to agentLedger's shared
  libs. Bring `claude-extract.ts`, `extract/text.ts`, the upload step,
  `wizard.ts`, `draft.ts`, `validation.ts`, `party-form`/`persons-form`/
  `commission-form`/`phone-input`/`wizard-chrome` components.
- Wizard submit → `services/createDeal` → DynamoDB (source) + `mirrorOut` to
  **Deals_Raw_Data** (so the existing Make PDF scenario keeps firing on its
  `pdfStatus` column) and to Red File.
- Prefill the wizard from the linked accepted offer + property +
  signed-contract records.
- One wizard submission per deal; two-sided deals keep the wizard's existing
  `representation` + `otherSideRepresentedBy` model; one-sided deals require
  contact detail only for the represented side (already how
  `validation.ts` works).
- Redirect sikkumPigisha's Amplify URL → `/deals/new`. Its users re-login once
  (new `SESSION_SECRET`).

**Ships:** one app, one login. Second codebase gone.

### Phase 3 — Green Invoice income + expense engine
Goal: income and expense records come from Green Invoice documents, not typed
numbers.

- Green Invoice **production cutover** (real `client_id`/`secret`, prod
  base URL — see `src/lib/green-invoice/client.ts`).
- חשבון עסקה (300) creation stays a **button** — for a deal (client commission,
  already built: `createTransactionAccountForDeal`) and, new, for an agent
  (`billAgentExpenses` — bundles the agent's outstanding `expense` rows into
  one 300). Each 300 recorded in `gi-documents` with its target.
- `/api/green-invoice/webhook` — verify signature, on a receipt (305/320/400):
  resolve its linked 300 → `gi-documents` → target.
  - target = deal → create `income` (source `webhook`) → auto-post commission
    (`commissionForPayment`, already built) → advance the deal's payment
    lifecycle.
  - target = agent-expenses → mark those `expenseEntryIds` paid → create a
    `payment_by_agent` covering them.
  - Scheduled poll of GI's documents list as a fallback for missed webhooks.
- Manual upload portal (manager): upload a GI PDF → key amount / date / target
  → same row creation, `source: "manual"`, PDF to S3 + Drive.
- Remove the free-text "log payment" amount field from the deal page.
- Recurring expenses: a `recurring-expenses` config (from the
  `agents and recurring expenses` sheet — משרד / מדלן / פרמי per agent) +
  a monthly scheduled job that writes the `expense` rows.

**Ships:** income and expenses can't drift from Green Invoice.

### Phase 4 — Pipeline entities + propagation
Goal: the linked pipeline agents and managers navigate and update.

- Cross-link the entities and define propagation (`src/lib/services/pipeline.ts`):
  - offer → **Accepted** ⇒ linked property Listing Status → "In Negotiation";
    WhatsApp the agent a prefilled summary-of-terms link.
  - deal → **signed** ⇒ property → "Signed". deal → **paid** ⇒ property → "Paid".
    deal → **cancelled** ⇒ property → "Active".
  - each rule runs on both the hub write and (via `mirrorIn`) a Monday change.
- Signed-form email ingestion: an inbound mailbox → `/api/inbound-signed-form`
  → Claude extract (reuse `claude-extract.ts`) → draft `signed-contracts` row
  → Levi confirms in a review queue → matched to property / deal by
  name + address.
- "Add / update property" form in the hub (rebuild of the spot-nik form):
  prefill owner from the seller's signed contract, Google Maps address
  autocomplete, price + attribute edits, photo upload. `mirrorOut` to
  Properties Raw Data.
- Deal notes: append-only thread on every deal and potential deal. Scope:
  own deals (agent) / team (team leader) / all (manager) — reuse
  `src/lib/auth/scope.ts` `allowedAgentNames`.
- Offers: agent creates/edits an offer in the hub or it syncs from the Google
  Form; agent marks Accepted.

**Ships:** agents self-serve notes, properties, offers; pipeline status is live.

### Phase 5 — Daily report, agent standing, notifications
Goal: replace the manual Excel tabs and the WhatsApp-by-hand handoffs.

- Agent standing view: per agent — income − expenses = net, plus a per-deal
  payment lifecycle strip (client paid? / commission owed / invoice requested /
  my חשבונית מס uploaded / Ariyel paid / my קבלה uploaded).
- Daily report generator `/reports/daily?date=` — agent standings, a "to pay
  today" section, the RE/MAX Israel receipts section, the bank-balance
  snapshot. Ariyel gets a "payments to make" checklist view.
- RE/MAX Israel receipts — a manual entry form (pending the Open Question).
- Notifications via WABA (`src/lib/waba/client.ts`) — the handoff list:
  offer accepted, deal marked signed, client payment received (→ agent sends
  invoice), agent invoice received (→ Ariyel), Ariyel paid (→ agent, prompt
  for קבלה), agent expense billed, exclusivity expiring.

**Ships:** the daily report and standings come out of the hub.

### Phase 6 — Monday retirement
- Stop `mirrorOut` / `mirrorIn`. Archive Deals_Raw_Data, Red File, Properties
  Raw Data, Signed Contracts, Offers, Referrals. Keep Daf Kesher (identity).
- Rebuild the summary-of-terms PDF in-app (Google Docs API call right after
  `createDeal`, per sikkumPigisha's own `MAKE_SCENARIOS.md` v1.5 note) and
  drop the Make PDF scenario.
- Full pre-2026 backfill if wanted.

### Later (noted, not scheduled)
WhatsApp-first management (natural-language commands over the service layer);
design pass on the hub + the summary-of-terms form; secretary ad-publishing
tools; the deduplicated Contact layer; bank-CSV import feeding the cash-flow
reconciliation (`copy תזרים מוזמנים 2026.xlsx`); agent self-service
"mark signed" with a fraud-control gate (uploaded signed-contract page / co-sign).

---

## Open questions

- **RE/MAX Israel receipts.** From the 30/08 daily report: rows like
  "חזון · בר כוכבא 70 · שולה אברמסקי · רימקס ישראל קיבלנו 26,438 · 31,196.25 ·
  מס' חשבונית 221510 · עליזה · הפניה ירושלים". Read as: for some deals
  (cross-office / RE/MAX-Israel-processed referrals) the client pays **RE/MAX
  Israel**, which issues the tax document (invoice numbers ~221xxx, not the
  office's Green Invoice) and remits to RE/MAX Jerusalem. So these are deal
  income whose receipt is **outside** the office GI account. Plan assumes a
  manual entry form in Phase 5. **Confirm** the money path, whether there's any
  feed/export from RE/MAX Israel, and whether the office's own GI still
  produces anything for these.
- **Signed-form email parsing.** Which forms, from which addresses, and how
  structured is the content (a clean PDF with labelled fields vs. a scan)? Are
  the 3 signing programs' Make scenarios shareable — they may already carry
  structured data we can POST instead of parsing an email.
- **Offers Google Form + its Make scenarios** — Levi to share; determines
  whether offers sync automatically or are re-entered.
- **Per-deal payment lifecycle** — confirm the states:
  `owed → invoice_requested → payable → paid → receipted`, and what Levi keys
  when entering a payment (amount, date, notes, method?).
- **Notification list** — confirm each handoff above should fire a WhatsApp,
  and the exact message wording per RE/MAX brand.
- **Green Invoice webhooks** — confirm they're available on the plan and what
  events/payload they send (else the poll fallback is the primary path).
- **`mirrorIn` transport** — Monday webhooks vs. scheduled poll (poll is
  simpler and the bridge is temporary).

---

## Verification

- **Phase 0** — hub loads at the Amplify URL; `npx tsc --noEmit`,
  `npx next lint`, `npx next build` clean; a new `check-tables`-style script
  reports all tables + GSIs reachable.
- **Phase 1** — change a deal in Monday → it appears in the hub within the poll
  window; change it in the hub → Monday updates; kill the Monday token → writes
  land in the dead-letter log, `resync` clears it. Backfill count matches the
  Monday board's 2026 item count.
- **Phase 2** — run the wizard end-to-end in the deployed hub against sandbox
  Monday: a Deals_Raw_Data item is created with `pdfStatus = "building pdf"`
  and the Make scenario emails the PDF. Drive the UI with the browser MCP as in
  prior sessions.
- **Phase 3** — create a 300 from the hub; issue a 320 against it in GI
  sandbox; confirm the webhook creates the `income` row, auto-posts the
  commission (check both `amount` and `amountExVat`), and advances the deal
  lifecycle. Repeat for an agent-expense 300 → `payment_by_agent`.
- **Phase 4** — accept an offer → property flips to "In Negotiation" and the
  agent gets the prefilled link. Forward a signed haskama to the inbox →
  a draft signed-contract appears in Levi's review queue.
- **Phase 5** — `/reports/daily` for a past date reconciles against that day's
  PDF in the accounting Drive folder (spot-check David Weiser's line — his
  ledger already reconciles to ₪23,286.36 incl / ₪19,734.20 excl).
