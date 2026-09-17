# Agent Ledger — Roadmap

The single source of truth for where this project is going. Code comments that
say "see the roadmap plan" / "the Agent Hub plan" mean this file. Earlier
planning docs live in [`docs/archive/`](docs/archive/) — where they disagree
with this file, this file wins.

Last reworked: 2026-09-09. Phase 4 closed + Phase 5/6 expanded 2026-09-10.
Phase 9 (native property wizard + Gantt + Monday sync bridge) brought
current 2026-09-17 — see §3 and the Phase 9 section for what's actually
live today.

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
| **4** | App owns its agent directory: `agents` table, admin CRUD, auth reads it (not Monday), id-based scoping + agent picker, Daf Kesher ⇄ app sync bridge + daily cron, office-check hardening (4f). Weiser ledger backfilled into `agent-account`. | ✅ done |
| **5** | Multi-tenancy hardening (5a/5b: office-scoped GSIs, write-time office assertion). 5c–5e (offices table, per-office GI creds/VAT, platform super-admin) deliberately deferred until office #2 is near. | ✅ 5a/5b done, 5c–5e deferred |
| **6** | Green Invoice income/expense engine: production GI, webhook + poll fallback, agent monthly expenses (recurring + bulk import), `billAgentExpenses`. | ✅ done |
| **7** | Daily report (north star) — office-expenses, bank-transactions/balances, RE/MAX Israel receipts, `/reports/daily` 3-section report. WhatsApp handoff notifications not built. | ✅ core done, WhatsApp handoffs pending |
| **8** | Deal-intake wizard merged in (`/deals/new`, 18 steps, AI upload extraction), replacing sikkumPigisha. `/sikkum` deep link live. | ✅ done, sikkumPigisha not yet decommissioned (8f) |
| **9** | Native property wizard (`/properties/new`, full field parity), property status/detail/edit pages, secretary notifications, Gantt exclusivity view (now the default `/properties` landing page), Monday sync bridge for properties. | ✅ mostly shipped and deployed 2026-09-17 — **except the sync bridge, reported broken (data looks wrong on screen), needs work** — see the Phase 9 section |

**What works today:** deploy at `main.d2aqfzo6esnq4n.amplifyapp.com`, OTP login,
role-scoped dashboard / deals / per-agent ledger, deal creation with auto-billing,
log-payment → auto-commission, Green Invoice 300 + receipt creation, the full
deal-intake wizard (`/deals/new`), the daily accounting report
(`/reports/daily`), and — as of this week — a native property-listing wizard
(`/properties/new`), property status/detail/edit pages with secretary
notifications, an exclusivity Gantt view (`/properties`, the default landing
page for the properties area — the flat list moved to `/properties/list`),
and a two-way Monday sync bridge for properties (deployed and pulled in 295
existing Monday listings on first run — **but Levi reports the synced data
looks wrong on screen; not yet diagnosed, needs real work**, see the Phase 9
section).

**Build/deploy infra**: Amplify build time optimized 2026-09-16 (skip nvm's
default-packages reinstall in `amplify.yml` — ~58s/build saved, ~4m42s → ~3m44s).
Free tier is 1,000 build-minutes/month; this app has used a small fraction of
that across its whole history — deploy cost is a non-issue at current pace.

**Known debt carried forward** (each addressed in a phase below):
- ~~Identity read from Monday; app-role column missing~~ → **fixed Phase 4**
  (auth reads the `agents` row's `role`; `BOOTSTRAP_ADMIN_*` still break-glass).
- ~~`scope.ts` matches by name string; deals store a typed name~~ → **fixed
  Phase 4c** (id-based; agent picker; old rows migrated).
- ~~Deal write actions only `requireSession()`~~ → **fixed Phase 4c** (all
  behind `requireManager()`).
- ~~Queries not office-scoped; single-item pages don't check `row.officeId`~~
  → **fixed Phase 5a/5b** (byOfficeId GSIs, `listAll` deleted, `sameOffice`
  guards, store write-time assertion).
- Commission tiers (`commission-tiers.ts`) and Green Invoice creds are global
  constants / env, not per-office. → **Phase 5c / 5d**
- Free-text "log payment" amount on the deal page — should come from GI. → **Phase 6**
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
- **`AgentRecord`** (Phase 5a): `status` gains `onboarding`;
  `commissionSchemeId`, `expenseChargeDate` (from a new Daf Kesher date
  column), `officeFeeExVat?`, `licenseNumber?`; and the add form exposes the
  sync-only `fullNameEnglish` / `firstNameHebrew` / `surname`.
- **`Office`** (Phase 5c): `branding`, `settings.{vatRate, defaultLocale,
  dealIntakeUrl, publicLinks[], commissionSchemes[], defaultCommissionSchemeId,
  standardExpenses, greenInvoice{env,clientId,clientSecretEnc}}`.

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
  1. ✅ `scripts/import-agents-from-monday.mjs` — roster pulled into `agents`
     (30 agents, `mondayItemId` set). `scripts/migrate-deal-agent-ids.mjs` +
     `backfill-deal-team.mjs` run — 14 deals repointed to `agt_` ids + team.
  2. Sync window (now): inbound `POST /api/sync/agents` runs daily via
     `.github/workflows/sync-agents.yml` (needs repo secret `SYNC_SECRET`;
     also a button on `/admin/agents`). Outbound app→Monday on every admin
     write (`mirrorAgentToMonday`), `MONDAY_SYNC_ENABLED=false` to disable.
     Let it bake as long as Levi wants — no fixed week; watch the
     `/admin/agents` mirror-failure banner and the sync result counts.
  3. Cutover: announce, freeze Monday edits, final sync, flip to `agents`-only.
     (`src/lib/monday/*` deletion happens in Phase 10 with the rest.)
  - Only Daf Kesher is synced. The other Monday boards (Properties, Offers,
    Signed Contracts, Referrals, Deals) each get their own bridge in
    Phases 8–10, not here.

**Open decisions — archive behaviour (D1–D5 below).**

**Verification:** create an agent in the UI → they can OTP-login → land on their
(empty) ledger. Archive an agent with history → login blocked, balance still
renders, hard-delete refused. `scope.ts` scopes by id (kill the Monday token →
team-leader scoping still works).

### Phase 5 — Multi-tenancy hardening + the office/agent data model

**Goal:** true isolation (office A cannot reach office B's data by any path),
and the per-office / per-agent config that a second office needs — commission
schemes, expense prices, branding — moved off global constants onto records
that an office admin can edit. Also the agent lifecycle + richer agent record.

Split into shippable slices. **5a + 5b done 2026-09-10 (isolation complete).
5c–5e wait until office #2 is actually near** (decision D8).

#### 5a — office-scoped queries + land the data model — ✅ done (`f475d64`, `ba67c26`)

- **`byOfficeId` GSI** on `deals` (HASH `officeId`, RANGE `createdAt`),
  `agent-account` (RANGE `date` — also serves the Phase 7 report),
  `billing` + `income` (RANGE `createdAt`). New `scripts/add-office-gsis.mjs`,
  admin creds (the scoped app user has no `UpdateTable`); online backfill.
  Also regularise the 4 core tables into `create-tables.mjs` (undocumented
  which script first made them).
- **Replace both `listAll()` scans** — `listDeals(officeId)`,
  `listAgentBalances(officeId)` / `listAllLedgerEntries(officeId)` → office GSI
  query. **Delete `listAll` from `dynamo-store.ts`** (or eslint-ban it).
  Callers pass `session.officeId`.
- **New fields, landed now so no re-migration later** (empty-ish 30-row agents
  table + 14 deals — trivial today, painful after office #2):
  - `AgentRecord.status`: add **`onboarding`** (`onboarding | active |
    archived`). Login = "not archived". Onboarding agents are hidden from
    deal-assignment pickers (already filter to `active`). Mostly a tracking
    dimension, not an access change.
  - `AgentRecord.commissionSchemeId` — which office scheme this agent is on;
    defaults to the office default at creation, editable.
  - `AgentRecord.expenseChargeDate` — when the agent starts paying monthly
    expenses (NOT join date; can be months out). Synced from a **new Daf
    Kesher date column** (Levi to add it; wire the id into `monday/columns.ts`
    + `roster.ts`). Derived `firstChargeMonth` = round UP to next full month
    (no partial months — Levi confirming the rule with the broker-owner).
  - `AgentRecord.officeFeeExVat?` — per-agent office-fee override (post-July
    joiners pay 350 not 300; manual override beats a fragile date rule).
  - `AgentRecord.licenseNumber?`, and the add form gains the currently
    sync-only optional fields: `fullNameEnglish`, `firstNameHebrew`,
    `surname`. Required stays name + (phone|email) + role.
  - _(deferred to 5c: `Office` type + `agent-ledger-offices` table.)_
  - _Done: `commissionSchemeId` is type-only until 5c defines the schemes.
    `expenseChargeDate` is a manual input — the Daf Kesher date column is still
    on Levi._

#### 5b — office guards + write-time assertion — ✅ done (`59c4c52`)

- **`assertOffice(row, session)` helper** → `notFound()` on mismatch. Apply
  after every `getDeal` / `getAgentById` at a page/action (`/deals/[id]`,
  `/agents/[agentId]` currently unguarded). Generalises the Phase 4f fix.
- **`update()` in `dynamo-store.ts`** gains `expectedOfficeId?` — it already
  fetches `existing`, so throw on `existing.officeId !== expectedOfficeId`.
  Per-entity `updateDeal` / `updateBilling` / `updateIncome` / `updateAgent`
  thread `officeId`. `insert()` asserts `item.officeId` is non-empty.

#### 5c — `offices` table + settings page

- **`Office`**: `id`, `name`, `ownerAgentId`, `status`, `plan`,
  `branding` (`displayName`, `logoUrl?`, `primaryColor?`, `accentColor?`),
  `settings`:
  - `vatRate` — *nationally uniform in IL; leave `VAT_RATE = 0.18` a constant
    with a "one place to change" comment unless a non-IL office onboards*
    (decision A)
  - `defaultLocale`, `dealIntakeUrl`, `publicLinks[]`
  - **`commissionSchemes[]`** — `{ id, name, tiers: CommissionTierRule[] }`.
    Arbitrary thresholds; the bracket-blend engine already handles any shape
    (e.g. beginner `[{0,0.30},{250000,0.50}]`, flat `[{0,0.60}]`).
    `defaultCommissionSchemeId`. New office seeded with a starter set.
  - **`standardExpenses`** — unit prices: office fee 300, Yad2 55, מדלן 255,
    Torah Tidbits 100. Feed the recurring office-fee charge and the
    bulk-import pre-fill (Phase 6).
  - **`greenInvoice`** — `{ env, clientId, clientSecretEnc }`. Each office its
    own Morning account. Secret **AES-256-GCM at rest** with a new
    `OFFICE_SECRETS_KEY` env var (same "key in env, ciphertext in DB" pattern
    as `SESSION_SECRET`) — not KMS (decision C).
- **`/admin/settings`** (admin-only) — CRUD the office record. The
  commission-schemes sub-editor (repeatable scheme blocks, each with
  repeatable threshold→rate rows) is the fiddliest widget; functional first,
  visual polish is Phase 11.
- **`agent-ledger-offices`** added to `create-tables.mjs` + `scripts/seed-office.mjs`.

#### 5d — flip the globals to read the office record

- **`tiersForAgent(agent, office)`** — look up `agent.commissionSchemeId` on
  the office, return its tiers. Delete `commission-tiers.ts`'s hardcoded
  `BY_ID` / `FLAT_60_NAMES`. Changing an agent's scheme affects only *future*
  commission — posted ledger entries are historical facts; the YTD tier cursor
  carries over.
- **`green-invoice/client.ts`** `getConfig()` takes an office (or its GI
  block) instead of `process.env`. Token cache keyed by `officeId` (currently
  a module singleton — breaks with 2 accounts). Test against the GI sandbox
  first; keep an env fallback for one release.
- **VAT** (only if decision A flips) — `stripVat` / `addVat` /
  `computeBillingAmount` take an explicit `rate`, default `0.18`; service +
  report layer pass `office.settings.vatRate`.

#### 5e — platform super-admin (D7)

- `SessionPayload.platformAdmin?` — set at login from `PLATFORM_ADMIN_EMAILS`
  env (Levi). Distinct from office-scoped `role: "admin"`.
- Can `listOffices` and open any office's data via an **explicit** office
  switch (`/platform` area or `?asOffice=`) — never implicit "see all". Every
  cross-office read/write → `logAudit({ kind: "platform_access", ... })`
  (audit sink exists). Functional support tool, no UI polish.

**Decisions:**
- **D6** — one customer, multiple offices? **No — office = tenant, flat.** Add
  an `org` layer only when a real customer needs it.
- **D8** — do 5c–5e now or defer? **Defer** until office #2 is on the horizon;
  5a+5b (isolation + model) are the only urgent part.
- **A** — per-office VAT? **No**, keep the constant (IL-uniform).
- **B** — commission override location? **The `agents` row**
  (`commissionSchemeId`), edited in the existing agent admin UI.
- **C** — GI secret encryption? **env-key AES-256-GCM**, not KMS.

**Verification:** seed a second office + its admin. Office-A admin sees no
office-B agents / deals / balances in any list; `getDeal(officeB_dealId)` at a
page 404s; a crafted server-action POST with office-B's id is refused with
nothing written. Commission math uses office-A's schemes.

### Phase 6 — Green Invoice income + expense engine

**Goal:** income and expense rows come from Green Invoice documents and bank
activity, not typed numbers.

- **GI production cutover** — real per-office `clientId` / `clientSecret`, prod
  base URL. (Token endpoint is on a different domain than the resource API —
  `api.morning.co` vs `api.greeninvoice.co.il` — this is correct, not a typo.)
- ✅ **`gi-documents` table** wired (`store/gi-documents.ts`, keyed by the GI
  doc id; flat `targetKind`/`dealId`/`agentId`/`expenseEntryIds`; `byDealId`
  GSI). `Income` gained `source` / `giDocId` / `paymentMethod`.
- **חשבון עסקה (300) stays a button** — ✅ for a deal. Records the
  `gi-documents` 300 with its `{deal}` target; the line uses the deal side's
  catalog מק"ט + a normalised Hebrew description template (`866bd61`,
  `green-invoice/gi-items.ts` — English + real city come with the wizard,
  Phase 8). ✅ **Send to agent / client** — repeatable, with a send log, via
  `POST /documents/{id}/distribute` (`876ec5c`). WhatsApp send → Phase 7.
  New: for an **agent** (`billAgentExpenses` bundles outstanding `expense`
  rows into one 300 with an `{agent-expenses}` target) — pending, with the
  expense engine.
- ✅ **End-to-end verified in prod** 2026-09-10 — the 300 button, the
  `300→305→400` and `320→300` chains, 305=invoiced-only, 320/400=income +
  commission + `paymentStatus`. Test data purged.
- ✅ **`/api/green-invoice/webhook`** (`5a3afe2`) — HMAC-SHA256(secret, body)
  verify → Redis idempotency on the GI doc id → `processGiDocument`
  (`green-invoice/webhook-handler.ts`, shared with the poll):
  - **300** ignore · **305** record + mark invoiced · **320/400** walk
    `linkedDocuments` to the 300 (320→300, 400→305→300, GI-API fallback) →
    `gi-documents` target → `income` per `transactions[]` → `recordDealPayment`
    (commission + `paymentStatus` roll-forward).
  - target = **agent-expenses** → recorded but not yet acted on (needs the
    expense engine: mark `expenseEntryIds` paid + a `payment_by_agent`).
  - ✅ **poll fallback**: `/api/green-invoice/poll` + `gi-poll.yml` (daily,
    bearer `SYNC_SECRET`).
  - The app's "Create receipt" button + `createIncomeReceipt` were **removed** —
    Levi/Ariyel issue 305/320/400 in GI, the webhook reacts.
- **Manual upload portal** (manager): upload a GI PDF → key amount / date /
  target → same row creation, `source: "manual"`, PDF to S3. — later.
- **The free-text "log payment" amount field** stays for now as a labelled
  manual fallback (Levi, 2026-09-10) — not removed.
- ✅ **Agent monthly expenses — two mechanisms** (`42b5b81`, `b528698`), both
  writing `expense` rows to `agent-account` (negative, dual VAT, no `dealId`),
  both honouring `isChargeableInMonth` (blank/past `expenseChargeDate` =
  chargeable now; mid-month rounds up — `src/lib/expense-schedule.ts`):
  1. **Recurring / fixed** — `agent-ledger-recurring-expenses` table (key `id`,
     GSIs byAgentId/byOfficeId). `seedOfficeFee` adds one "דמי משרד" row per
     agent at creation (amount = `officeFeeExVat` override or
     `STANDARD_EXPENSES` = 300; `office-defaults.ts`, → `office.settings` in 5c).
     מדלן / פרמי added in `/admin/agents/[id]` (list + add + pause).
     `runMonthlyExpenses` (idempotent, entry id `rex-<row>-<month>`) via
     `POST /api/expenses/run-monthly` + `expenses-monthly.yml` (daily 20–24th).
  2. **Variable — bulk import** — `/admin/expenses/import`: paste/CSV per vendor
     per month (`agent · date · number · cost` pre-VAT), preview with
     `matchAgent` (alias → exact → fuzzy), fix + commit. Idempotent per
     (vendor, agent, date, qty, cost). Redis: batch (1h) + nickname→agentId
     alias hash. Description `"Yad2 — 6 × ₪55 (15/9)"`.
  - ✅ **`billAgentExpenses`** (`3db804b`) — bundles unbilled `expense` rows into
    one multi-line 300 (`{agent-expenses}` target, GI client resolved by name
    + cached on `agent.greenInvoiceClientId`); the webhook's agent-expenses
    branch posts a `payment_by_agent` once Levi issues the 320/400. "Bill now"
    on `/admin/agents/[id]`. GI retainers retired (no retainer line-editing
    API — the hub assembles, GI still charges the card).
  - See `docs/mem/office-expenses-model.md`. Open: the July 300→350 cutoff;
    whether an API-created GI doc can trigger the saved-card charge.
  - This system replaces the Monday "Expense" board (retired Phase 10).
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

- ✅ **`office-expenses`** table + admin form (`/admin/finance`) — 7 categories
  (CC fees, עירייה, cleaning, pension, loan, ad vendor, other).
- ✅ **`bank-transactions` + `bank-balances`** — paste-import (`/admin/finance`)
  of the Bank Leumi "תנועות בחשבון" export (`src/lib/bank-import.ts`,
  docs/mem/bank-export-format.md), de-duped per office, settled daily balance
  derived per date. Not CSV/OFX-automatic yet — Levi pastes the export.
- ✅ **`remax-israel-receipts`** — manual entry form on `/admin/finance`
  (client, agent, gross, received, invoice #, notes).
- ⏳ **Agent standing view** — the full per-deal payment-lifecycle strip
  (invoice requested / חשבונית מס uploaded / Ariyel paid / קבלה uploaded)
  needs a `Deal` lifecycle field that doesn't exist yet. **V1 proxy shipped**:
  `/reports/daily` interleaves each agent's `due`/`partial_payment` deals.
- ✅ **`/reports/daily?date=`** (`a6d73f9`) — the 3 sections:
  1. Agent table — every non-archived agent, today's הוצאות/הכנסות (ledger
     movement) + cumulative יתרה תזרימית, outstanding-deal rows interleaved,
     totals row. **Verified**: reproduces David Weiser's reconciled
     ₪23,286.36 exactly.
  2. בנק — prior-day balance, today's credits/debits, closing balance.
  3. רימקס ישראל — the day's receipts table.
  Prev/next-day nav. Not yet built: Ariyel's "payments to make" checklist view,
  PDF export (renders as a page today).
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

**Hard constraint (Levi, 2026-09-14): the wizard already works and is
QA'd — port it faithfully.** Step order, validation rules, and field
behavior are untouched; only the data-layer calls change (Monday reads →
agentLedger's `agents` table, Monday-only submit → DynamoDB + mirror).

**Key finding:** sikkumPigisha has no database of its own — every step's
draft lives in Redis, and the final submit writes `create_item` straight onto
the **Deals_Raw_Data** Monday board. Levi's Make scenario watches that
board's `pdfStatus` column to build the Google Docs PDF + email it. So this
phase is the same shape as the Phase 4d Daf Kesher bridge: DynamoDB becomes
the source, Monday becomes a mirror that keeps the Make scenario firing
unmodified.

- ✅ **`/sikkum` one-click deep link** (`5c37789`) — an agent with no ledger
  session hits `/sikkum`, `middleware.ts`'s `DEEP_LINKS` map sends them to
  `/login?next=/deals/new`; OTP success lands them straight on the wizard
  (`safeNextPath` in `action-utils.ts` guards against an open redirect).
  Already logged in → `/sikkum` skips login entirely. No second auth system.
- ✅ **8a — foundation** (`d156fb5`) — deps (`@anthropic-ai/sdk`,
  `react-hook-form`, `@hookform/resolvers`, `libphonenumber-js`, `mammoth`,
  `pdf-parse`); `Deal` gained `docLanguage`/`otherSideRepresentedBy`/
  `pdfStatus`/`mondayItemId`/`propertyId`/`offerId`; `src/lib/wizard/`
  (`draft.ts`, `steps.ts`, `commission.ts`, `form-parse.ts`, `validation.ts`)
  ported verbatim, keyed by the real session's **agentId** (Redis), not a
  second draftId/JWT.
- ✅ **8b — all 18 step routes + shared components** (`49d89d3`), folded
  together with 8e's prefill matching since they're one working unit —
  `party-form`, `persons-form`, `commission-form`, `phone-input`,
  `wizard-chrome`, `did-you-mean`, `person-suggestions`, `wizard-choice`,
  `wizard-step-error`, `wizard-submit-button`, `property-match.ts`,
  `offer-match.ts`, and the full Monday layer (`src/lib/wizard/monday/`:
  properties/clients/offers/deals + column maps) all live at
  `app/src/app/deals/new/(wizard)/*`. Step order, validation, and field
  behavior are byte-for-byte unchanged. `/deals/new` (bare) now resumes the
  draft's `furthestStep` or starts fresh — **it replaces the old
  manager-only quick form outright**; that form's `submitNewDeal` action is
  dead code, removed in 8d.
  - Owner-agent/buyer-agent's colleague picker now reads `listAgentsByOffice`
    instead of Daf Kesher — its own picker UI (search + manual-entry toggle)
    is untouched, only the data source moved.
  - **Real finding, not anticipated in this plan when written**: Properties
    Raw Data / Signed Contracts / Offers ownership is a Monday
    `board_relation` keyed by the **Monday pulse id**, not agentLedger's own
    `agt_<uuid>`. Every call into the ported Monday layer (property/offer/
    client pickers, the picker-selection ownership re-check, referral/
    commission prefill, `writeBackClients`) now resolves and passes
    `AgentRecord.mondayItemId` — get this wrong and the picker silently
    shows "no properties found" or the ownership re-check throws on every
    real selection.
  - New env vars, added to `next.config.ts`'s `SERVER_ENV_KEYS` and
    `.env.local`, **still needs adding to the Amplify console**:
    `MONDAY_PROPERTIES_BOARD_ID=1633691694`, `MONDAY_DEALS_BOARD_ID=1946512255`.
- ✅ **8d — submit path** (`7737bc4`) — `submitDeal()` now creates
  agentLedger's own `Deal`(s) + opening `Billing` FIRST (`src/lib/wizard/submit.ts`
  maps the draft onto `NewDealInput`), one per represented side
  (`representation: "both"` → two Deals, owner + buyer, each billed
  separately — a colleague named on the other-side step never gets an
  auto-created Deal, since the wizard only ever captures their name/phone/
  email as free text, no agentId). The Monday `createDealItem` mirror
  (unchanged column mapping) still runs right after and keeps driving
  Levi's Make.com PDF scenario exactly as before; its `mondayItemId` is
  linked back onto the new Deal(s) afterward.
  - **An agent-submitted wizard never lands a deal in `signed` stage**:
    `NewDealInput.forceStage: "potential"` overrides the normal
    signingDate-driven inference. **Gap, not built here**: there's
    currently no UI anywhere in agentLedger (old quick-form deals
    included) to flip a deal's stage after creation — Levi doing that
    "manually" today means a direct DB edit, not a button. Worth a small
    follow-up if this blocks testing.
  - `referralPercent` (agentLedger's "% of the commission" contract) is
    derived from both sides' pre-VAT shekel amounts, not a raw ratio of the
    wizard's entered figures — correct even when the main commission and
    the referral used independent VAT-mode toggles and/or different units.
  - Per-side idempotency: each Deal's id is saved to the draft
    (`submittedDeals`, keyed by side) the instant it's created, so a retry
    after a failed Monday mirror — or after only one side of a "both"
    submission succeeded — never re-creates (double-bills) a side that's
    already there.
  - Deleted the old quick-form's now-dead `submitNewDeal`
    (`src/app/deals/actions.ts`) — `/deals/new` has been the wizard's
    landing page since 8b.
  - **sikkumPigisha itself is completely untouched and keeps working** —
    separate repo/deploy, still writing straight to Monday. Levi keeps
    using it for real intake until he's ready to cut over (8f); the two
    intake paths coexist with zero interaction until then.
- ✅ **8c — AI extraction (upload step)** (`aea59be`) — `claude-extract.ts` +
  `extract/text.ts` (mammoth/pdf-parse, falls back to Claude vision for
  images/scanned PDFs) ported verbatim, including its own two known-bug
  TODOs from Levi's 2026-08-16 report against sikkumPigisha (ignores
  `representation` when flagging missing fields; over-infers "both sides"
  on meeting-summary docs) — not silently fixed. `/deals/new/upload` is now
  the true entry point for a fresh draft (was a TODO left in 8b);
  extraction jumps `furthestStep` straight to `review` so the agent
  verifies everything at once. `ANTHROPIC_API_KEY` added to
  `next.config.ts` + `amplify.yml`'s build-time passthrough (was already in
  the Amplify console but the build wasn't capturing it — same class of
  gap as the two Monday board-id vars). Model string
  (`claude-sonnet-4-6`) carried over unchanged, matching what sikkumPigisha
  already runs in production — worth asking Levi if he wants it bumped to
  claude-sonnet-5, not assumed.
- ✅ **Found live-testing 8a-8e, fixed same day**: a "potential" (unsigned)
  deal was showing a payment status ("waiting for payment") when nothing
  is actually owed yet — `createDealWithBilling` created a real Billing row
  regardless of stage. Fixed (`ed9cdd8`): `Deal.paymentStatus` is now
  optional/unset until signed; a new `markDealSigned()` (services/deals.ts)
  is the ONLY place Billing gets created for a wizard-originated deal —
  triggered by a new manager-only "mark as signed" button on `/deals/[id]`,
  which is the actual fraud-gate control point (an agent's own wizard
  submission can never reach it). Also added (`810f2a3`): `/deals/new`
  asks "continue or start fresh?" instead of silently resuming a draft
  that's sat untouched over an hour (the draft itself survives 12h, tied
  to session length).
- **8f — cutover**: point sikkumPigisha's Amplify domain at `/sikkum`;
  decommission the repo/deploy after a verification window.
- Rebuild the summary-of-terms PDF in-app (Google Docs API right after
  `createDeal`) — or keep the Make scenario until Phase 10.

**Verification:** run the wizard end-to-end in the deployed hub as an agent
(via `/sikkum`, cold) → a deal is created, billing opens, the PDF is
produced, Deals_Raw_Data shows the mirrored item. sikkumPigisha's domain
redirects.

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
    **9a done** (`PropertyRecord` in `src/lib/types.ts`, `src/lib/store/
    properties.ts`, `byOfficeId` GSI added) — see "Native property intake"
    progress note below; this is the same table, now with the full ~90-field
    Superform/Monday-parity inventory rather than the short list above.
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

**Native property intake (in progress, supersedes the "add/update property
form" bullet above with full field parity)** — replaces the external
Superform (`superform.spot-nik.com/form/66f3eedf7560d752eaab3ac0`) with a
native wizard, same pattern as Phase 8 for deals. Drive is the storage
source of truth for photos/documents — agentLedger only stores a
`{driveFileId, webViewLink}` pointer, never the bytes (deliberate reversal
of the Decisions Log's old "S3 + auto-copy to Drive" answer below — see
that row). No Monday write in this phase.
- **9a — DB + storage scaffolding:**
  - DB: ✅ done. `byOfficeId` GSI added to `agent-ledger-properties`
    (predated Phase 5, had none). `PropertyRecord` type (full field
    inventory, grouped by wizard step). `src/lib/store/properties.ts`.
    `DYNAMODB_TABLE_PROPERTIES` wired (`.env.local`, Amplify console,
    `next.config.ts`).
  - Places API (New): ✅ done, verified live end-to-end with real
    Jerusalem addresses (`src/lib/places.ts` + `places-actions.ts` +
    `src/components/address-autocomplete.tsx`). Server-only key (calls go
    through a server action, never reaches the browser — revised from an
    earlier NEXT_PUBLIC_ plan). Field mask pinned to the Essentials SKU
    tier so this never bills at the pricier Pro/Enterprise rates.
  - Google Drive (`src/lib/google-drive.ts`): ✅ done, verified live —
    folder-per-year/property creation + real file upload both confirmed
    working. Writes go into a **dedicated Shared Drive**, not yet the
    office's real existing `נכסים בטיפול רימקס חזון` folder — domain-wide
    delegation (which would write directly into the real structure) was
    attempted first, kept failing with `unauthorized_client` in the
    Workspace Admin console regardless of which account was impersonated,
    and Levi parked it rather than keep debugging live. A bare service
    account has zero Drive storage quota and can't write into a regular
    person's My Drive folder at all (confirmed live) — a Shared Drive
    sidesteps that: the service account is a member, writes against its
    pooled storage, no impersonation needed (`supportsAllDrives=true` on
    every Drive call). `ensurePropertyFolder()` builds the same
    `{year}/{street} {building}-{apartment}` shape the real folder uses,
    so moving into the real structure later (revisit delegation, or some
    other reconciliation) is a relocation, not a restructuring.
- **9b/9c/9d — the wizard itself:** ✅ done, all 10 steps, deployed and
  live at `/properties/new`. Deal type → **contract-pick** (redesigned —
  see below) → address (Places, editable after) → commission (+
  exclusivity dates) → property type/referral/external agent → media
  (Drive uploads) → descriptions (HE/EN + Yad2) → technical details →
  internal ratings (office-only) → review → creates a real
  `PropertyRecord`. Property type / referral source option lists are a
  reasonable standard set, not reconciled against Monday's exact dropdown
  values — both are plain strings, easy to adjust later. All dropdowns
  are searchable (`components/ui/searchable-select.tsx`, RTL-aware).
- **Live-testing fixes** (2026-09-16, from Levi's first real run-through):
  a nav entry + `/properties` list page (there was previously no way to
  even find the wizard); address auto-fill now splits the trailing
  building number into `buildingNumber` instead of leaving it stuck on
  `street` (`src/lib/property-wizard/address-parse.ts`), and
  `apartmentNumber` is required (agents enter `0` if not applicable); a
  real i18n bug where `messages/{he,en}.json` had flat dotted keys
  (`"propertyType.apartment"`) instead of nested objects, so next-intl
  silently rendered the raw key path instead of the translation — fixed
  by real nesting; the media step crashed on any upload because Next's
  server actions default to a 1MB body limit — raised to 50MB
  (`next.config.ts`).
- **Exclusivity data model** (2026-09-16, corrected from Levi's real
  Monday data): a haskama (agreement to pay commission, can stand alone)
  and a biladiut (exclusive advertising rights, ~6 months, never exists
  without an accompanying haskama) are two separate rows on Monday's
  Signed Contracts board for the same client+property — commission
  always comes from the haskama row specifically, exclusivity dates from
  the biladiut row (`listSellersForPropertyWizard`,
  `src/lib/wizard/monday/clients.ts`). **Contract-pick step redesigned**:
  the agent first states whether this listing is exclusive
  (biladiut) or agreement-only (haskama), *then* picks from a list
  already filtered to that bucket — the server re-verifies the picked
  contract actually belongs to the claimed bucket before trusting it.
  `PropertyRecord` gained `exclusivityStartDate`/`exclusivityEndDate`
  (prefilled from the biladiut row, always editable) and `contractType`.
- **Property status, detail, and edit pages** (2026-09-16/17):
  `PropertyStatus` (`active | sold | rented | off_market | withdrawn`) is
  a new required field, independent of the contract's own exclusivity
  state. `/properties/[id]` (detail — owner/commission/exclusivity/media/
  technical, internal ratings manager-only, update history) and
  `/properties/[id]/edit` (owning agent or any manager). Editing anything
  triggers **`notifyPropertyUpdated()`**
  (`src/lib/services/property-notify.ts`): saves immediately, records a
  diff-based change summary, and notifies the secretary — in-app (a
  capped Redis feed at `/admin/notifications`, manager-only) plus
  email/WhatsApp, each independently killable via
  `PROPERTY_NOTIFY_EMAIL_ENABLED` / `PROPERTY_NOTIFY_WHATSAPP_ENABLED`
  env vars (default on). WhatsApp needs a Meta-approved template
  (`META_WABA_PROPERTY_UPDATE_TEMPLATE_NAME`) before it can actually
  send — until then it's treated as "channel not configured," never a
  hard failure. Email goes through a new generic Make.com webhook
  (`MAKE_NOTIFICATION_WEBHOOK_URL`), separate from the existing OTP-only
  one. Media/internal-ratings editing is **not yet built** on the edit
  page (deferred).
- **Exclusivity Gantt view** (2026-09-17) — `/properties` is now the
  **default** properties view (a lightweight custom Gantt, no charting
  library); the flat list moved to `/properties/list` (linked from the
  Gantt and vice versa). One route serves manager (sees everyone) and
  agent (sees own + team) via the existing `allowedAgentIds` scoping.
  Bars are colored by % of the exclusivity period elapsed (<50% green,
  50–75% yellow, 76–90% orange, 90%+ red — `src/lib/services/
  property-gantt.ts`), thickness scales inversely with how many bars are
  shown, and month gridlines run down through every bar via a CSS grid
  (label column and chart column are separate grid columns, so a
  gridline never drifts under the name column — an earlier bug). Haskama-
  only (non-exclusive) listings appear as a plain list below the chart.
  All/Sales/Rental tabs on both the Gantt and the list. **Known rough
  edges, not yet fixed** (Levi, 2026-09-17): overall Gantt polish still
  needed (dates/display "a bit rough" — no specifics pinned down yet);
  a separate CSS bug where the exclusivity end-date label overlaps the
  owner-name area on some property page (not the Gantt — exact page not
  yet identified). Whole-site mobile optimization is explicitly deferred
  (agents mainly use mobile, managers mainly PC) — not started.
- **Monday sync bridge** — same shape as agents' Phase 4d bridge
  (`src/lib/sync/agents.ts`). Built and deployed 2026-09-17 (was held back
  on purpose pending review; now live). `src/lib/sync/properties.ts` —
  inbound `syncPropertiesFromMonday()` pulls every Properties Raw Data
  item into the `properties` table (so listings entered the old way, or
  via the Superform this wizard replaces, show up here too),
  matched/linked by a new `PropertyRecord.mondayItemId`; outbound
  `mirrorPropertyToMonday()` pushes a wizard-created property back to the
  same board, called synchronously right after `createProperty()` in
  `review/actions.ts` (never throws — dead-letters to Redis on failure,
  same as `mirrorAgentToMonday`). `/api/sync/properties` (POST,
  `SYNC_SECRET`-guarded) + `.github/workflows/sync-properties.yml` (daily
  cron via GitHub Actions, same secret as `sync-agents.yml`). The first
  manual run reported 295 created / 12 skipped (no matching agent) / 7
  skipped (no deal type) / 0 errors — the full 314-item board — but
  **Levi reports the synced data looks wrong once it's actually on
  screen in the app (2026-09-17)**. Not yet diagnosed or fixed — **needs
  real work**: exact symptom not yet pinned down (which page, which
  field(s)). **Scope limit** regardless: only the fields already
  reconciled in `PROPERTIES_BOARD` round-trip (address, owner contact,
  commission %/VAT, dealType, rooms/size/price) — the wizard's full
  ~90-field inventory (media, descriptions, technical, ratings) has no
  reconciled Monday column mapping and does not sync either direction yet.
- **Demo/seed tooling**: `scripts/seed-demo-gantt.mjs` — idempotent,
  reversible (`--write` / `--remove`) fictitious Gantt data for
  demoing/testing the color bands against real agents/office. Not part
  of the app itself.

**Planned next, not started — team/neighbourhood performance stats**
(2026-09-17, planning only, no code yet): Levi wants monthly/quarterly/
custom-range stats (new exclusives, income, deals signed, more TBD) per
agent *and* per team — where **"team" is actually a neighbourhood
grouping** (e.g. team 1 = Arnona + Talpiot), not just an org chart. A
single deal can produce three attributions: the agent personally, the
agent's own team ("production"), and whichever team owns the property's
neighbourhood ("area volume") — these two team numbers can differ (an
agent selling outside their own patch). Decided so far:
- **Neighbourhood capture**: currently a real gap — `Deal` has no
  structured neighbourhood field (only a free-text `propertyAddress`),
  and the deal wizard's Monday-board property picker fetches a
  neighbourhood value but discards it. Fix: Google Places Autocomplete
  needs adding to the deal wizard's manual-entry address path too
  (mirroring the property wizard), and the picker path must stop
  discarding what it already fetches — persist `Deal.neighbourhood` in
  both paths, auto-filled but always agent-editable. **Also**: the
  property wizard's own `PropertyRecord.neighbourhood` field exists in
  the type but nothing populates it yet — `src/lib/places.ts` only
  extracts city/street/building number, not the neighbourhood address
  component. Needs fixing regardless of the stats project.
- **Historical deals** (everything signed before this ships): no
  neighbourhood was ever stored — they show as "unassigned" in area
  stats going forward. Not backfilled.
- **Area-team resolution is live, not frozen**: unlike `Deal.team` (the
  agent's own team, which already freezes at creation for permission
  scoping — unchanged, separate mechanism), a deal's *area*-team is
  resolved at report-render time from `Deal.neighbourhood` + whatever
  the neighbourhood→team mapping says *right now*. Redraw a team
  boundary later and historical area reports shift immediately — nothing
  to backfill.
- **Blocked on**: Levi's neighbourhood→team list (promised next). Once
  that lands: fix Places-neighbourhood extraction in both wizards → add
  `Deal.neighbourhood` capture → build the neighbourhood→team config →
  build the actual stats/reports pages (admin: period selector +
  agent/team/area view toggle; agent personal: own numbers + team
  numbers with the org/area split visible, for team leaders).

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

- **Google Drive auth via Workload Identity Federation, not a static
  service-account key.** Phase 9's Drive integration ships first with a
  downloaded service-account JSON key (`GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
  in env). Levi flagged WIF (aws.amazon.com's compute role → GCP token
  exchange, no long-lived secret ever stored) as a follow-up hardening
  pass — not blocking the first ship. Would mean: a GCP Workload Identity
  Pool + Provider configured to trust the app's AWS role (`agent-ledger-hub-
  compute`) via its STS-issued token, granted impersonation rights on the
  Drive service account, and `google-drive.ts` exchanging that instead of
  signing a JWT from a stored private key. Do this once the wizard is
  live and stable, not as part of the initial build.
- **Search on every list page** — deals, agents, per-agent ledger, and each
  pipeline-entity list get a search/filter box. Not yet built; fold into the
  design pass (Phase 11) or do per-page as the lists grow. (Agents list already
  has team/name sorting as of Phase 4b.)
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
- **Agent-facing "deals needing my attention" view** (Levi, 2026-09-14, while
  testing Phase 8): an agent should be able to open something that answers
  "which of my deals need me to go chase someone" — e.g. N deals still
  `potential` (follow up with the lawyers/clients to get to signing), N
  deals `due`/`overdue` on payment (follow up with the client, or a
  colleague agent, about why it hasn't been paid). `/deals` already lists
  an agent's own deals with stage + paymentStatus shown inline (scoped via
  `filterDealsByIds` — agent sees own, team leader own+team, manager/admin
  all), but nothing groups/filters toward "what needs action today," and
  there's no guidance on WHO to chase for a given stuck deal. Not designed
  yet — needs Levi's input on what "needs my attention" should actually
  group by/surface before building.

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
| D8 | Build Phase 5c–5e now? | **Defer** — 5a+5b (isolation + data model) are the urgent part; the settings page / GI refactor / platform admin wait until office #2 is near |
| A | Per-office VAT rate | **No** — `VAT_RATE = 0.18` stays a constant (nationally uniform in IL) |
| B | Per-agent commission override lives where | On the `agents` row (`commissionSchemeId`), edited in the agent admin UI |
| C | GI client-secret encryption at rest | env-key AES-256-GCM (`OFFICE_SECRETS_KEY`), not KMS |
| E1 | No-partial-months expense rule | Round `expenseChargeDate` up to next full month *(Levi confirming with broker-owner)* |
| E2 | Bulk-import `cost` column | Assumed unit price (line = qty × cost) *(confirm)*; July 300→350 office-fee cutoff date *(confirm)* |
| — | Monday's future | **Full decommission** — every board including Daf Kesher. 2-way sync bridge, then off. |
| — | Client signing | The hub does **not** sign clients. It ingests emailed copies of signed forms, Claude-parses them, Levi confirms, matches to deals. |
| — | Pipeline model | Linked entities, **manual status first**, propagation rules added incrementally. |
| — | Wizard merge | **Yes**, but after the agents-table + multi-tenancy phases (Phase 8), not early. |
| — | Deal financial terms | Anchored to the signed sikkum — agents can complete *missing* fields, never edit provided figures. |
| — | Ariyel | Broker-owner. Uses the hub mainly for reports; does Levi's job when Levi's away → `admin` role. |
| — | Commission | Full commission charged; agent expenses billed via credit card in Green Invoice. |
| — | Doc storage | ~~S3 source of truth + auto-copy into the accounting Google Drive folder.~~ **Reversed, Phase 9**: Drive is primary for property media/documents — agentLedger stores only a `{driveFileId, webViewLink}` pointer, never the bytes. Cost-driven (Levi: tables/queries are cheap regardless of volume on `PAY_PER_REQUEST`; file storage is the real cost lever, and the business already uses Drive). The existing S3-based agent-invoice/receipt attachments (Phase "agent payout") are low-volume and NOT migrated — out of scope. |
| — | Backfill | 2026-forward for now; full historical backfill is a later phase. |
| — | PDF fidelity | "Pretty similar" is fine — a clean rebuild, not byte-identical. |
| — | Design | One dedicated pass near the end (Phase 11); the public open page not designed until it's greenlit. |
| — | Property edit fields | Agents can edit their own listing's info, but every edit notifies the secretary (she manually updates ~8 external sites) — no field is "silent." |
| — | Property notifications | Any field change → save immediately (no approval gate) + notify: in-app (per-property AND a global secretary feed) + email/WhatsApp, each independently killable via env flags. Levi: "I reserve the right to turn off certain notification channels." |
| — | Commission source (exclusive listings) | Always the **haskama** row specifically, never the biladiut row's duplicate copy, even when they agree. |
| — | Property status meaning | Listing lifecycle (`active/sold/rented/off_market/withdrawn`) — independent of the contract's own exclusivity window. |
| — | Gantt default view | `/properties` **is** the Gantt now; the flat list is the alternative, at `/properties/list`. |
| — | Sikkum/property-generated docs | **Not legally binding** — the summary-of-terms document says so explicitly. Same pattern to apply to referrals later: a click-to-agree consent step ("accepting this referral binds you to a 25% fee") before revealing data. |
| — | Team/neighbourhood stats — area-team resolution | **Live, not frozen** — a deal's area-team is computed at report time from the current neighbourhood→team mapping, unlike `Deal.team` (agent's own team, which stays frozen for permission-scoping). Redrawing a boundary later reshapes historical area reports immediately. |
| — | Team/neighbourhood stats — historical deals | **Unassigned, not backfilled** — deals signed before neighbourhood capture existed just show as unassigned in area stats. |

---

## 9. Monday.com decommission checklist

Runs across Phases 4 (Daf Kesher) and 10 (everything else).

- [x] `agents` table live, admin UI shipped (Phase 4)
- [x] Roster imported from Daf Kesher, `mondayItemId` set on each row
- [ ] Sync job running both directions — inbound cron live, baking (no fixed
      end date; Levi calls the cutover)
- [x] Auth (`findAgentByContact`, `roles.ts`) reads `agents`, not Monday
- [x] `scope.ts` matches by `agentId`; deals store real `agentId` + `team`
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
- **`README.md`** — fast-orientation snapshot (what's live, what's not, how
  to run it) for a session/dev with no prior context. Points here for detail.
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
