# Agent Ledger — Roadmap

The single source of truth for where this project is going. Code comments that
say "see the roadmap plan" / "the Agent Hub plan" mean this file. Earlier
planning docs live in [`docs/archive/`](docs/archive/) — where they disagree
with this file, this file wins.

Last reworked: 2026-09-09.

---

## 1. What this is

A standalone, multi-office SaaS for real-estate agencies to run the **agent side
of the books**: deals → billing → client income → per-agent commission ledger →
the office's daily accounting report. Plus Green Invoice (Morning) document
creation, WhatsApp/email OTP login, and a deal-intake wizard.

It began as an internal tool for **RE/MAX Jerusalem** (brand entity "Remax
Vision" / שאולוף נדל"ן והשקעות בע"מ), replacing a sprawl of Monday.com boards
("Red File", "Daf Kesher", commission sheets), a separate 18-step
"summary of terms" wizard app (**sikkumPigisha**), three external client-signing
programs, Green Invoice, and two hand-maintained Excel workbooks.

**End state:** one app RE/MAX Jerusalem agents open for everything, and a product
other independent offices can buy — each office fully isolated, seeing no trace
of any other.

**North star:** auto-generate the daily accounting report Levi produces by hand
today, and retire the manual cash-flow Excel. Everything else is in service of
getting there and then going further.

---

## 2. Architecture principles

1. **Multi-tenant from day one.** Every table row and every session carries
   `officeId`. True before a second office existed, so onboarding office #2 is a
   config change — not a migration to backfill a column.
2. **The app owns its own data.** No runtime dependency on Monday for any core
   entity. Monday is an import/sync bridge *during migration only*, then fully
   decommissioned — every board, Daf Kesher included.
3. **Service layer holds business logic.** `src/lib/services/*` are plain
   functions (no auth, no FormData, no redirect). Server actions, webhook
   handlers, and a future WhatsApp bot are all thin callers. This is what makes
   "manage the whole thing over WhatsApp" a later add-on, not a rewrite.
4. **Isolation is enforced at the data layer**, not the UI. Every read is
   office-scoped; every write asserts `row.officeId === session.officeId`.
5. **Config is per-office**, not global: VAT rate, commission tiers, Green
   Invoice credentials, branding, locale, the public-page link set.
6. **Green Invoice / the bank are the source of truth for money.** Income and
   expense rows are created from GI documents and bank activity, not typed
   numbers. Deal financial terms are anchored to the signed sikkum, not editable
   after the fact by the person whose pay depends on them.
7. **Functionality first, one dedicated design pass near the end.** Don't
   re-polish after every feature.
8. **Reuse, don't rebuild.** agentLedger and sikkumPigisha already carry
   near-identical `auth/`, `monday/client.ts`, `commission.ts`, `waba/client.ts`,
   `redis.ts`, locale toggle, and shadcn primitives. agentLedger's copies win
   (they have the role system); sikkumPigisha's extra pieces move over.

---

## 3. Status — what's built

| Phase | Scope | State |
|---|---|---|
| **0** | Deploy prep: DynamoDB tables, Amplify compute role, Node 22 pin, `create-tables.mjs` / `check-tables.mjs` | ✅ done |
| **1** | Core ledger on DynamoDB: deals / billing / income / agent-account; generic store helpers (`getById`, `insert`, `update`, `queryByIndex`) | ✅ done |
| **2** | Green Invoice integration (client resolve/create, חשבון עסקה/300, receipts 305/320/400), sandbox-verified end to end; i18n (he/en, cookie-based, RTL) | ✅ done |
| **3** | Role-based access (manager-only writes; agent/team-leader read-only), VAT-aware ledger (`amount` incl + `amountExVat`), auto-commission (bracket-blended by YTD tier), service-layer extraction | ✅ done |
| **3.5** | Deploy hardening: server env baked into the build via `next.config.ts` for Amplify SSR, IAM policy fixes, login verified end-to-end in prod. David Weiser's real 2026 ledger imported and reconciled (₪23,286.36 incl / ₪19,734.20 excl) | ✅ done |

**What works today:** deploy at `main.d2aqfzo6esnq4n.amplifyapp.com`, OTP login,
role-scoped dashboard / deals / per-agent ledger, deal creation with auto-billing,
log-payment → auto-commission, Green Invoice 300 + receipt creation.

**Known debt carried forward** (each addressed in a phase below):
- Identity is read from the Monday "Daf Kesher" board (read-only). App-role
  column doesn't exist → everyone resolves to `agent` unless `BOOTSTRAP_ADMIN_*`
  matches. → **Phase 4**
- `src/lib/auth/scope.ts` matches agents by **name string**, not ID; deals store
  a typed name as identity (`agentId === agentName`). → **Phase 4**
- Queries are **not office-scoped**: `listAll()` is a raw table scan; the
  balances dashboard sums every row. → **Phase 5**
- Commission tiers (`commission-tiers.ts`) and Green Invoice creds are global
  constants / env, not per-office. → **Phase 5**
- Deal write actions (`submitIncome`, GI actions…) only `requireSession()` — no
  per-deal ownership check. Effectively manager ops; gate them. → **Phase 4**
- Free-text "log payment" amount on the deal page — should come from GI. → **Phase 6**
- Weiser import needs one re-run with `--overwrite` to populate `amountExVat`
  (app uses the `entryExVat` fallback meanwhile — exact for 2026). → housekeeping
- Intermittent Amplify SSR platform error on server-action redirects
  (`ERR_SSL_WRONG_VERSION_NUMBER`) — does not block the flow.

---

## 4. Data model

### Live tables (DynamoDB, `PAY_PER_REQUEST`, eu-north-1)

| Table | Holds |
|---|---|
| `agent-ledger-deals` | The deal — parties, price, commission %, referral, stage, payment status |
| `agent-ledger-billing` | Gross owed by the client (VAT-incl, referral **not** subtracted) |
| `agent-ledger-income` | One row per actual client payment installment |
| `agent-ledger-agent-account` | The agent's running account with the office — commission / expense / payment_to_agent / payment_by_agent |

Types in `src/lib/types.ts`. GSIs `byAgentId` / `byDealId`.

### Tables already created by `create-tables.mjs`, not yet used

`agent-ledger-signed-contracts`, `-properties`, `-offers`, `-referrals`,
`-deal-notes` (GSI `byDealId` or `byAgentId`), `-gi-documents` (GSI `byDealId`
+ `byGiClientId`). Wired up in Phases 6 and 9.

### Planned new tables

| Table | Phase | Holds |
|---|---|---|
| `agents` | 4 | The office's own agent directory (replaces Daf Kesher reads) |
| `offices` | 5 | The tenant record — branding, settings, per-office GI creds |
| `office-expenses` | 7 | Non-agent office costs (CC fees, עירייה, cleaning, pension, loan) |
| `bank-transactions` / `bank-balances` | 7 | Bank reconciliation, fed by CSV import |
| `remax-israel-receipts` | 7 | Cross-office receipts processed by RE/MAX Israel |
| `recurring-expenses` | 6 | Per-agent standing monthly charges (משרד / מדלן / פרמי) |

### Fields to add to existing types

- **`Deal`**: `mondayItemId?`, wizard rich fields (parties, lawyers, per-side
  commission terms, communication language, `otherSideRepresentedBy`),
  `signedContractId?` / `offerId?` / `propertyId?`, `pdfStatus`, per-deal
  **payment lifecycle** (`owed → invoice_requested → payable → paid → receipted`),
  denormalised `teamId`.
- **`Income`**: `source: "app" | "webhook" | "manual"`, `giDocId?`,
  `attachmentKey?`.
- **`AgentLedgerEntry`**: wire the already-typed `attachments`
  (`AgentLedgerAttachment[]`) — the agent's חשבונית מס + קבלה on
  `payment_to_agent`, and expense docs.

---

## 5. Phases

Each phase is independently shippable and leaves the app working.

### Phase 4 — Agents table + admin management + Daf Kesher import

**Goal:** the app owns its agent directory. Admins manage agents in-app. Monday
"Daf Kesher" becomes an import/sync source on its way out.

- **`agents` table**, key `id` (UUID), GSI `byOfficeId`: `officeId`, `name`,
  `email`, `phone`, `role` (`agent | team_leader | manager | admin`),
  `teamId` (was `רובע`/district), `status` (`active | archived`),
  `mondayItemId?`, `createdAt`, `updatedAt`.
- **Auth switches to this table.** `findAgentByContact` reads `agents`, not
  Monday. `roles.ts` reads `role` from the row — the `__PENDING_appRole__`
  problem disappears. `BOOTSTRAP_ADMIN_*` stays as break-glass.
- **Admin UI** `/admin/agents` (admin-only):
  - list agents **in the admin's own office**
  - add (name / email / phone / role / team)
  - edit
  - **archive** (soft) — blocks login, hides from pickers, balance still
    viewable. **Hard-delete only when zero deals + zero ledger entries reference
    the agent.**
- **Fix identity matching**: `scope.ts` matches by `agentId`; deal creation
  gets an agent picker (real `agentId` + snapshot `teamId` onto the deal);
  `/deals/new` stops accepting an arbitrary typed name. Backfill old rows by name.
- **Gate the ungated write actions** (`submitIncome`, GI client/300/receipt
  actions) behind `requireManager()`.
- **Daf Kesher import → sync → cutover:**
  1. `scripts/import-agents-from-monday.mjs` — one-time pull of the RE/MAX
     Jerusalem roster into `agents`, setting `mondayItemId`.
  2. Sync window: a scheduled job keeps name/phone/email in step (Monday → app
     on a schedule; app → Monday on write via the Monday API — it supports item
     create/update/archive).
  3. Cutover: announce, freeze Monday edits, final sync, flip to `agents`-only.
     (`src/lib/monday/*` deletion happens in Phase 10 with the rest.)

**Open decisions — archive behaviour (D1–D5 below).**

**Verification:** create an agent in the UI → they can OTP-login → land on their
(empty) ledger. Archive an agent with history → login blocked, balance still
renders, hard-delete refused. `scope.ts` scopes by id (kill the Monday token →
team-leader scoping still works).

### Phase 5 — Multi-tenancy hardening

**Goal:** true isolation. Office A's admin cannot reach office B's data by any
path.

- **`offices` table**: `id`, `name`, `ownerAgentId`, `status` / `plan`,
  `branding` (`logoUrl`, `primaryColor`, `accentColor`, `displayName`),
  `settings`:
  - `vatRate` (was the global `VAT_RATE` constant)
  - `commissionTiers` + per-agent overrides (move `commission-tiers.ts` here)
  - `greenInvoice` — **each office has its own Morning account**; `clientId` /
    `clientSecret` / `env` move off env onto the office record, encrypted at rest
  - `defaultLocale`, `dealIntakeUrl`, `publicLinks[]` (Phase — public page)
- **`byOfficeId` GSI on every table.** Replace every `listAll()` scan with an
  office-scoped query. **Delete the unscoped `listAll` helper** (or lint-ban it).
- **Write-time assertion** in the store layer: `row.officeId === ctx.officeId`
  or throw — defense in depth on top of query scoping.
- `listAgentBalances`, deals list, ledger — all filtered to `session.officeId`.
- Remove the last global Monday call (`listAgentNamesInDistrict`) → query the
  `agents` table by `teamId` within office.
- **Platform super-admin** — a `platformAdmin` flag (Levi, for support), outside
  normal office scope, every cross-office access audited.

**Open decision D6:** can one customer own multiple offices (a franchise with
branches) and want a combined view? Default: **no — office = tenant, keep it
flat.** Add an `org` layer above `office` only when a real customer needs it.

**Verification:** seed a second office + its admin. Log in as office-A admin →
office-B agents / deals / balances are absent from every list, and a direct
`getDeal(officeB_dealId)` throws. Commission math uses office-A's tier table.

### Phase 6 — Green Invoice income + expense engine

**Goal:** income and expense rows come from Green Invoice documents and bank
activity, not typed numbers.

- **GI production cutover** — real per-office `clientId` / `clientSecret`, prod
  base URL. (Token endpoint is on a different domain than the resource API —
  `api.morning.co` vs `api.greeninvoice.co.il` — this is correct, not a typo.)
- **`gi-documents` table**: `id`, `officeId`, `giId`, `type` (300/305/320/400),
  `giClientId`, `amount`, `target` (`{kind:"deal", dealId}` or
  `{kind:"agent-expenses", agentId, expenseEntryIds:[]}`), `linkedDocId`,
  `s3Key`. GSI `byDealId`, `byGiClientId`.
- **חשבון עסקה (300) stays a button** — for a deal (client commission, built) and,
  new, for an **agent** (`billAgentExpenses` bundles the agent's outstanding
  `expense` rows into one 300). Each 300 recorded in `gi-documents` with its
  target.
- **`/api/green-invoice/webhook`** — verify signature; on a receipt
  (305/320/400) resolve its linked 300 → `gi-documents` → target:
  - target = **deal** → create `income` (`source: "webhook"`) → auto-post
    commission (`commissionForPayment`, built) → advance the deal's payment
    lifecycle.
  - target = **agent-expenses** → mark those `expenseEntryIds` paid → create a
    `payment_by_agent` covering them.
  - Scheduled poll of GI's documents list as a fallback for missed webhooks.
- **Manual upload portal** (manager): upload a GI PDF → key amount / date /
  target → same row creation, `source: "manual"`, PDF to S3.
- **Remove the free-text "log payment" amount field** from the deal page.
- **Recurring expenses**: `recurring-expenses` config (משרד / מדלן / פרמי per
  agent, from the `agents and recurring expenses` sheet) + a monthly scheduled
  job that writes the `expense` rows.
- **Money-flow rules** (from Levi):
  - full payment → חשבונית מס+קבלה (320). Partial payment, or a business pays →
    חשבונית מס (305) first, then קבלה (400) when the money lands.
  - agent expenses: Levi charges the agent's card *in Green Invoice*; the webhook
    marks the expense paid — the hub never touches the card.
  - the agent produces their own קבלה (they received the money); the office
    produces the חשבונית מס.
- **GI API quirks** (discovered live, not in the docs — keep):
  1. `currency` is required at the **document level**, not just per line-item.
  2. Receipt docs (305/320/400) require a `payment[]` row (default: bank
     transfer, code 4).
  3. `income[].price` must be **pre-VAT** (GI adds VAT via `vatType: 0`);
     `payment[].price` must be the **VAT-inclusive** total paid. Mismatch →
     "קיים חוסר התאמה בין סכום התקבולים לסכום התשלומים".

**Verification:** create a 300 from the hub → issue a 320 against it in GI
sandbox → webhook creates the `income` row, auto-posts commission (check both
`amount` and `amountExVat`), advances the lifecycle. Repeat for an agent-expense
300 → `payment_by_agent`.

### Phase 7 — Daily report, agent standing, office finances (NORTH STAR)

**Goal:** auto-generate the daily accounting PDF; retire the manual cash-flow
Excel (`copy תזרים מוזמנים 2026.xlsx`).

- **`office-expenses`** — non-agent office costs (agentId optional + `category`,
  or its own table): CC fees, עיריית ירושלים, cleaning service, keren
  hishtalmut / pension, loan principal + interest, ad vendors. Admin entry form.
- **`bank-transactions` + daily `bank-balances`** — fed by importing the bank's
  CSV/OFX, not typed. Covers section 2 of the report and the cash-flow Excel's
  full reconciliation.
- **`remax-israel-receipts`** — manual entry form: office, client, RE/MAX-Israel
  gross, amount received, invoice # (~221xxx, outside the office GI), agent,
  notes. For deals where the client pays RE/MAX Israel, which issues the tax doc
  and remits to the office.
- **Agent standing view** — per agent: income − expenses = net, plus a per-deal
  payment-lifecycle strip (client paid? / commission owed / invoice requested /
  my חשבונית מס uploaded / Ariyel paid / my קבלה uploaded).
- **`/reports/daily?date=`** — the 3 stacked sections of today's PDF:
  1. Agent table — every agent with הוצאות / הכנסות / יתרה תזרימית, plus
     interleaved "waiting for חשבונית" rows for deals not yet invoiced. Totals row.
  2. בנק — one-line snapshot: prior-day balance, standing-order debits
     (הורא.קבע), credits.
  3. רימקס ישראל — the receipts table above.
  Ariyel gets a "payments to make" checklist view.
- **WhatsApp notifications** (WABA) — the handoff list, each a message:
  offer accepted · deal marked signed · client payment received (→ agent, send
  your invoice) · agent invoice received (→ Ariyel) · Ariyel paid (→ agent,
  prompt for קבלה) · agent expense billed · exclusivity expiring.
  Invoice delivery: hub sends automatically; Levi wants it WhatsApp'd, with an
  "upload via the hub to notify Ariyel" fallback.

**Verification:** `/reports/daily` for a past date reconciles against that day's
PDF in the accounting Drive folder — spot-check David Weiser's line
(₪23,286.36 incl / ₪19,734.20 excl).

### Phase 8 — Merge the summary-of-terms wizard, retire sikkumPigisha

**Goal:** deal intake lives in the hub. sikkumPigisha gone.

- Move `sikkumPigisha/app/src/app/form/(wizard)/*` →
  `app/src/app/deals/new/(wizard)/*`; rewire imports to agentLedger's shared
  libs. Bring `claude-extract.ts`, `extract/text.ts`, the upload step,
  `wizard.ts` / `draft.ts` / `validation.ts`, and the
  party / persons / commission-form / phone-input / wizard-chrome components.
- **One wizard per deal** (Levi). Two-sided deals keep the wizard's existing
  `representation` + `otherSideRepresentedBy` model; one-sided deals need contact
  detail for the represented side only (already how `validation.ts` works) — and
  the office is "less interested" in the other side.
- Landlords/renters are handled exactly as sellers/buyers (already in
  `DealSide`).
- Wizard submit → `services/createDeal` → DynamoDB (source) → `mirrorOut` to
  Deals_Raw_Data during the bridge so the existing Make PDF scenario keeps firing.
- Prefill the wizard from the linked accepted offer + property + signed-contract
  (Phase 9 entities).
- Redirect sikkumPigisha's Amplify URL → `/deals/new`. Its users re-login once.
- Add the wizard rich fields to `Deal` (see §4).
- **Agent "mark signed" fraud gate** — deferred. For now **Levi marks a deal
  signed** (agents have lied about this). Later: require an uploaded
  signed-contract page, or a co-sign, before the agent can self-advance and
  produce their own חשבון עסקה.
- Rebuild the summary-of-terms PDF in-app (Google Docs API right after
  `createDeal`) — or keep the Make scenario until Phase 10.

**Verification:** run the wizard end-to-end in the deployed hub → a deal is
created, billing opens, the PDF is produced. sikkumPigisha's URL redirects.

### Phase 9 — Pipeline entities

**Goal:** the linked pipeline agents and managers navigate — replaces the
Signed Contracts, Properties, Offers, and Referrals Monday boards.

- Populate the tables already created by `create-tables.mjs`:
  - **`signed-contracts`** — parsed haskama / biladiut / buyer-rep: client
    name(s) + ID, side, **contract type** (`haskama` = agreement to pay
    commission / `biladiut` = exclusivity — a property is "in haskama" or "in
    biladiut"), property address, commission terms, signed date, exclusivity
    start/end, PDF `s3Key`. GSI `byAgentId`.
  - **`properties`** — address, gush/chelka, price, rooms/size, photo Drive
    links, listing status, link to the seller's signed contract. GSI `byAgentId`.
  - **`offers`** (הצעת מחיר) — buyer(s), property, price, payment terms, transfer
    dates, signature files, status (`follow-up | accepted | rejected |
    duplicate`). GSI `byAgentId`.
  - **`referrals`** — referring agent/office, contact, % of commission, linked
    deal/contract. GSI `byDealId`.
  - **`deal-notes`** — append-only: `dealId`, `authorId`, `authorName`, `body`,
    `createdAt`. GSI `byDealId`. Scope own / team / all via `scope.ts`.
- **Build as plain linked records first.** `deal.propertyId` / `.offerId` /
  `.signedContractId` enable navigation and wizard prefill; status is set
  manually. This alone replaces the four boards.
- **Add propagation rules incrementally, later** — one at a time, only where the
  manual step is genuinely annoying. First candidate: deal signed → property
  "Signed". The pipeline is meant to run forwards (signed contract/client →
  made offer → accepted → in negotiation → signed) **and talk backwards**.
- **Offers Google Form** (`forms.gle/D1XK8vxst8R7dsN2A`): agent fills it → gets a
  prefilled link → sends to the buyer → buyer fills details + signs → sends back.
  Make scenarios exist (Levi to share) — determines whether offers sync
  automatically or are re-entered. When the buyer is ours (~0.1% via form), the
  agent hand-fills an offer doc instead.
- **"Add / update property" form** — prefill owner from the seller's signed
  contract, Google Maps address autocomplete, price + attribute edits, photo
  upload.
- **Signed-form email ingestion** — inbound mailbox → `/api/inbound-signed-form`
  → Claude extract → draft `signed-contracts` row → Levi review queue → matched
  to property / deal by name + address. (Levi is reducing 3 signing programs to
  1.)

**Verification:** link a property → its offers → accepted offer → deal, and
navigate the chain. Forward a signed haskama to the inbox → a draft appears in
the review queue.

### Phase 10 — Monday.com full decommission

- Stop `mirrorOut` / `mirrorIn`. Archive Deals_Raw_Data, Red File, Properties
  Raw Data, Signed Contracts, Offers, Referrals, **and Daf Kesher**.
- Delete `src/lib/monday/*`; remove `MONDAY_API_TOKEN` /
  `MONDAY_AGENTS_BOARD_ID` from env and from `next.config.ts` `SERVER_ENV_KEYS`.
- sikkumPigisha also read Daf Kesher — moot once it's retired in Phase 8;
  confirm nothing else does.
- **spot-nik property auto-fill app** (separate Express codebase, see
  [`docs/archive/spot-nik-property-app.md`](docs/archive/spot-nik-property-app.md)):
  it currently pulls agent listings from the Monday **Properties Raw Data**
  board. When that board dies it needs re-pointing at this app's `properties` —
  expose `GET /api/properties?agentId=` returning the safe-subset fields (no
  seller PII, no commission). That app is a separate rewrite, **out of scope
  here** — flagged so it isn't forgotten.
- Full pre-2026 backfill if wanted.

### Phase 11 — Design pass + per-office branding

- **Full design pass** — layout system, data density, KPI cards, charts,
  empty / loading / error states, responsive, RTL polish. A professional
  dashboard, not a raw CRUD app.
- **i18n polish backlog** (collected as found):
  - Agent names render in Hebrew even on the English site — prefer
    `agent.fullNameEnglish` when the locale is `en` (the `agents` row carries
    both). Applies to the ledger page, deals list, admin list, nav.
  - Login/OTP server-action error messages (`lib/auth/actions.ts`) are still
    hardcoded English.
- **Per-office branding — scoped version only:**
  - `office.branding` → inject a `<style>` overriding the CSS design tokens on
    `<html>`; swap the nav logo.
  - **Not** in scope: custom fonts, layout variants, a theming engine.
- Build the token layer with this hook already in place.

---

## 6. Unscheduled / later

- **Public "open page"** — a pre-auth landing page (link launcher: Drive, forms,
  scheduling, review link, contact sheet, passwords doc, deal-summary /
  price-quote / referral forms), PWA-installable, plus actions agents can take
  before logging in vs. after.
  - **Deferred until agents actually start using the hub day-to-day** (much
    later). Not designed until then.
  - This page is **RE/MAX Vision-specific** — several links are meaningless to
    another office. It's a per-office config (`office.settings.publicLinks`),
    not a shared feature. `middleware.ts` gets public routes that bypass the
    login redirect when it's built.
- **WhatsApp-first management** — natural-language commands over the service
  layer ("update property X to price Y", "create a summary of terms for
  property X with buyer Y at price Z", "upload this receipt").
- **Deduplicated Contact layer** — start with Signed Contract as the unit; add a
  Contact entity later.
- **Secretary ad-publishing tools.**
- **Gold club (מועדון הזהב) / quarterly targets** — not modelled.
- **Full pre-2026 historical backfill.**

---

## 7. Open questions (need Levi / external)

| Topic | What's needed |
|---|---|
| **RE/MAX Israel receipts** | Confirm the money path (client → RE/MAX Israel → office), whether any feed/export exists, and whether the office GI still produces anything for these. Assume manual entry (Phase 7). |
| **Signed-form email parsing** | Which forms, from which addresses, how structured (clean labelled PDF vs. scan)? Are the 3 signing programs' Make scenarios shareable — they may already carry structured data to POST instead of parsing. |
| **Offers Google Form + its Make scenarios** | Levi to share — determines auto-sync vs. re-entry (Phase 9). |
| **Per-deal payment lifecycle** | Confirm the states `owed → invoice_requested → payable → paid → receipted`, and what Levi keys when entering a payment (amount, date, notes, method?). |
| **Notification wording** | Confirm each handoff fires a WhatsApp, and the exact RE/MAX-brand message text per handoff. |
| **Green Invoice webhooks** | Confirm they're on the plan and the event/payload shape (else the poll fallback is primary). A sandbox "Document Created" webhook was set up 2026-08-23 → a Make hook, currently unused. |
| **`mirrorIn` transport** | Monday webhooks vs. scheduled poll (poll is simpler; the bridge is temporary). |
| **Four role-specific Hebrew remarks texts** | seller / buyer / renter / landlord wording for the 300 document — `src/lib/green-invoice/remarks-templates.ts` has TODO placeholders. |
| **Expense category list** | Pull from `agents and recurring expenses` + the `data` sheet's `הפעולה` column before building the entry form. |

---

## 8. Decisions log

| # | Question | Decision |
|---|---|---|
| D1 | Archived agent with an outstanding balance | Freeze visible — no forced settlement *(default lean; confirm)* |
| D2 | Archived agent's open deals | Reassign on archive, admin picks *(default lean; confirm)* |
| D3 | Archived agent's recurring expenses | Auto-stop *(default lean; confirm)* |
| D4 | Re-adding a previously archived agent | Reactivate the same record *(default lean; confirm)* |
| D5 | Who can create an admin | Another admin only *(default lean; confirm)* |
| D6 | One customer, multiple offices | **No — office = tenant, flat.** Add an org layer only when a real customer needs it. |
| D7 | Platform super-admin scope | Read-all + impersonate, every access audited |
| — | Monday's future | **Full decommission** — every board including Daf Kesher. 2-way sync bridge, then off. |
| — | Client signing | The hub does **not** sign clients. It ingests emailed copies of signed forms, Claude-parses them, Levi confirms, matches to deals. |
| — | Pipeline model | Linked entities, **manual status first**, propagation rules added incrementally. |
| — | Wizard merge | **Yes**, but after the agents-table + multi-tenancy phases (Phase 8), not early. |
| — | Deal financial terms | Anchored to the signed sikkum — agents can complete *missing* fields, never edit provided figures. |
| — | Ariyel | Broker-owner. Uses the hub mainly for reports; does Levi's job when Levi's away → `admin` role. |
| — | Commission | Full commission charged; agent expenses billed via credit card in Green Invoice. |
| — | Doc storage | S3 source of truth + auto-copy into the accounting Google Drive folder. |
| — | Backfill | 2026-forward for now; full historical backfill is a later phase. |
| — | PDF fidelity | "Pretty similar" is fine — a clean rebuild, not byte-identical. |
| — | Design | One dedicated pass near the end (Phase 11); the public open page not designed until it's greenlit. |

---

## 9. Monday.com decommission checklist

Runs across Phases 4 (Daf Kesher) and 10 (everything else).

- [ ] `agents` table live, admin UI shipped (Phase 4)
- [ ] Roster imported from Daf Kesher, `mondayItemId` set on each row
- [ ] Sync job running both directions, verified for one full week
- [ ] Auth (`findAgentByContact`, `roles.ts`) reads `agents`, not Monday
- [ ] `scope.ts` matches by `agentId`; deals store real `agentId` + `teamId`
- [ ] sikkumPigisha retired (Phase 8) — nothing else reads Daf Kesher
- [ ] Pipeline entities live (Phase 9) — Signed Contracts / Properties / Offers /
      Referrals boards no longer written
- [ ] Wizard writes go to DynamoDB only; Make PDF replaced or bridged
- [ ] Announce cutover date to the office
- [ ] Freeze Monday edits → final sync → flip app to DynamoDB-only
- [ ] Archive all boards: Deals_Raw_Data, Red File, Properties Raw Data,
      Signed Contracts, Offers, Referrals, Daf Kesher
- [ ] Delete `src/lib/monday/*`
- [ ] Remove `MONDAY_API_TOKEN`, `MONDAY_AGENTS_BOARD_ID` from env +
      `next.config.ts` `SERVER_ENV_KEYS`
- [ ] Re-point the spot-nik property app at this app's `/api/properties`
      (separate effort — see Phase 10)

---

## 10. Repo & docs map

- **Git repo root** is `D:\Dev\agentLedger\app` (the `app/` subdir, not its
  parent). Remote: `github.com/lygold/agentaccounts`, branch `main`.
- **`ROADMAP.md`** (this file) — canonical plan.
- **`docs/reference/`** — narrow, accurate notes: running locally, role scoping,
  commission auto-calc, the Weiser import, the deals-identity gap, the daily
  report spec, external file paths, who Levi is.
- **`docs/archive/`** — superseded planning: the original architecture plan, the
  "Agent Hub" plan (`.md` / `.html`), the 2026-09-07 status snapshot, the
  spot-nik property-app plan, the raw session transcript.
- **`../answers to questions.txt`** (outside the repo) — raw planning Q&A;
  substance folded into this file, kept as history.
- **`system_prompt.md`** in sikkumPigisha — the tuned ad-copy prompt (relevant
  to the spot-nik app, not this one).
