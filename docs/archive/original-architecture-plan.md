# Agent Accounting & Receipts System — Roadmap / Architecture Plan

## Context

Right now agent income, expenses, recurring office charges, tiered commission splits, and running per-agent balances are tracked by hand in one Excel workbook (`accounting/2026/...xlsx`, synced via shared Google Drive) — **confirmed as the actual system Ariyel pays agents from today.** Live inspection of both the Excel and the org's Monday account turned up several *other*, partially-built parallel attempts that turned out **not** to be the real thing (kept here only as reference for data-model design, not integration targets):

- **Red File** (Monday board 1816827169, 583 items) — per-deal item fed from `Deals_Raw_Data` (sikkumPigisha's own write target), with subitems tracking each client payment installment (status, amount, an invoice-file attachment, a "reported to Remax" checkbox). Its `total fee NEW` formula and its `Office Commission` formula disagree on referral handling (below) — never reconciled.
- **Billing 2026+ / Income 2026+** (5089936085 / 5089936128, 5 items each) — a newer attempted split of billing vs. actual-received, never really adopted.
- **"Expense" board** (1788567792, 48 items, sitting in a separate "Dev RemaxJerusalem" workspace) — an earlier attempt at the Excel `data` sheet as a Monday board, with the tiered-commission split hardcoded directly into a Monday formula column (450k/650k thresholds, 50/55/60%, with boundary pro-rating).
- **Agent Commission board** (2051539007, 174 items, recently updated) — looked live at first glance but isn't what actually drives payment.

The one piece that **is** solid and should stay exactly as-is: **Daf Kesher** (Monday board 1593085910) is the shared agent-identity source — confirmed to be the literal same board sikkumPigisha's own `MONDAY_AGENTS_BOARD_ID` already points to, owned by you, Ariyel, and Benny Rev.

The referral-subtraction bug you flagged is real and lives in the formulas themselves: Red File's `total fee NEW` and Billing 2026+'s `Total Bill` both compute `price × commission% × 1.18` with **no** referral subtraction, while Red File's separate `Office Commission` formula *does* apply a referral cut (×0.75) before splitting office-vs-agent — two different answers to "what is this deal worth," never reconciled. This is the same tiered-commission concept flagged as future scope during the sikkumPigisha commission-referral wizard work (`חלוקת עמלות` sheet: ₪450k/₪650k/₪1M → 50%/55%/60%) — this system is that feature's real backing data.

**The actual end-to-end process, as you described it:**

1. sikkumPigisha wizard submission → Deals_Raw_Data (Monday, unchanged) signals a deal is in negotiation.
2. Deal signs.
3. Request for payment sent to the client.
4. Client pays → you check the bank account, issue a receipt via **Green Invoice** (has an API).
5. You log it in the Excel; send the agent a request for their own tax invoice (חשבונית מס).
6. Their tax invoice arrives → you notify Ariyel (today: manually, via the Daily Report) that he should pay them.
7. You see the payment land in the bank account → log the row in Excel.
8. A "pay agent" record should carry **two attachments**: the agent's tax invoice (authorization to pay) and the Kabbala (proof you've paid) — both should also be pushed to the existing shared Google Drive folder.

**Decision, based on your answers:** build one new, separate system that properly implements what Red File / Billing 2026+ / Income 2026+ / Agent Commission board were each separately, incompletely attempting — **not necessarily on Monday**. The only two Monday touchpoints that stay: `Deals_Raw_Data` (upstream trigger, unchanged) and `Daf Kesher` (shared agent identity, read-only).

**Phase 1 is built** (repo scaffold, data model, manual-entry UI, admin dashboard — smoke-tested 2026-08-22) using a single shared admin password, on the assumption it'd be Levi-only. That assumption changed (see "Roles & permissions" below) — Phase 1's auth layer gets reworked, not thrown away; its data/UI foundation stands.

## Roles & permissions

Four tiers, confirmed:

- **Admin** (Levi) — full access, everything.
- **Manager** (e.g. Ariyel, Benny Rev) — sees every team, not just one. Same day-to-day operational actions as admin (log income, post commissions/expenses, record agent payments, change any deal's stage) — this is an assumption to confirm, not something explicitly specified; the one hard line is that user/role management itself stays admin-only.
- **Team Leader** — scoped to their own team, where **a team = every agent sharing the same district (`רובע`)** on Daf Kesher (reuses existing data, no new assignment to maintain). This phase: **view-only** — their team's deal pipeline (stage/status only, no $ figures, no individual commission/balance visibility for teammates). No edit actions yet.
- **Agent** — scoped to only their own deals and own balance. Concretely, an agent can:
  - View their own deals: stage, how much the client has paid so far, and any notes.
  - View their own commission / running balance (their own money — full visibility).
  - Advance a deal's **stage** from `potential` → `signed` (that specific transition only — nothing else stage/payment-related).
  - Upload their own tax invoice (חשבונית מס) once applicable.
  - Add free-text notes to their own deal.
  - **Complete missing fields** on a deal that arrived incomplete from sikkumPigisha (sikkumPigisha already has an "incomplete submission" concept — `validateDraft`/`issues[]`/"Manual Steps Necessary" — this mirrors it deliberately).
  - **Cannot** edit already-provided deal figures (price, commission %, referral) — if those are wrong, the fix is submitting a new sikkumPigisha form, not editing here. This keeps the deal's financial terms anchored to a single authoritative source (the signed sikkum), not editable after the fact by the person whose pay depends on them.

### Identity & role source

Reuse **Daf Kesher** (Monday board 1593085910) as the single identity+role source, same as today:
- Login: reuse sikkumPigisha's OTP-via-WhatsApp/email pattern (`src/lib/auth/actions.ts`, `src/lib/waba/client.ts`), looked up against this same board — no new credentials to distribute to ~29 people.
- Team grouping: the existing `numeric_mm0dwhxf` (`רובע`) column.
- Team-leader flag: the existing `color_mm1j9dvy` (`Is Team Leader`) column.
- **New column needed**: an explicit app-role field (e.g. Agent / Team Leader / Manager / Admin) so Levi assigns roles in the one place he already manages everyone — "Is Team Leader" alone doesn't distinguish Manager from Admin.

### Deal stage vs. payment status (splits Red File's conflated single "Status" column)

- **`stage`**: `potential` (arrives from sikkumPigisha) → `signed` (agent-advanced) → `cancelled` (admin/manager).
- **`paymentStatus`**: `due` / `partial_payment` / `paid` / `overdue` / `dead_debt` — derived from Billing vs. Income where possible (received = 0 → due, 0 < received < billed → partial_payment, received ≥ billed → paid), with `overdue`/`dead_debt` as explicit admin/manager flags. Keeping this separate from `stage` is deliberate — Red File's single Status column mixes "where is this deal in its lifecycle" with "is the client behind on paying," which is exactly the kind of conflation this rebuild is meant to fix.
- New Deal fields: `notes` (free text, agent-editable) and `incompleteFields` (which required fields are still missing, so the agent's view knows what to prompt for).

## Architecture

- **New, standalone project** — separate repo and deployment from sikkumPigisha. Confidential financial data never touches the agent-facing wizard's codebase, even though the two apps share the same Daf Kesher identity board and OTP login pattern.
- **Role-based access** — admin/manager/team-leader/agent, resolved from Daf Kesher at login (see "Roles & permissions" above). Not single-admin as originally scoped for Phase 1.
- **DynamoDB + S3** as the source of truth — a real query/aggregation layer for the sum-by-agent/sum-by-quarter/tiered-lookup work every existing sheet and board is straining to do by hand or in fragile formulas. S3 holds receipt/invoice/Kabbala files.
- **Connected to sikkumPigisha via the two things that already work:** `Deals_Raw_Data` (Monday) as the trigger — reuse the existing Make.com automation pattern already wired into this ecosystem (per `MAKE_SCENARIOS.md`) to push new/updated deal items into the new system, rather than inventing a fresh webhook mechanism — and `Daf Kesher` as the read-only agent-identity lookup (same board, same `id`/`name`/`phone`/`email` shape sikkumPigisha's `src/lib/monday/agents.ts` already reads).
- **Green Invoice API** — direct integration (not just recording a reference), designed against the real API docs (`developers.morning.co`) — see "Green Invoice integration" below for the full design.
- **Google Drive push** — the two payment attachments (tax invoice + Kabbala) get uploaded to the existing shared Drive folder via the Drive API, so the human-browsable archive you already rely on keeps working exactly as it does today.

## Data model

- **Deal** — replaces Red File's role. `id`, `agentId` (Daf Kesher item id), `dealType`, `side`, `salePrice`, `commissionPercent`, `hasReferral` + `referralPercent`, `signingDate`, `sikkumDate`, `stage`, `paymentStatus`, `notes`, `incompleteFields`, `greenInvoiceClientId` (see "Deal stage vs. payment status" above — two separate fields, not Red File's one conflated Status — and "Green Invoice integration" below for the client-id field). One correct formula for deal value (referral-subtracted, VAT-explicit) instead of Red File's two disagreeing ones.
- **Billing** — the gross amount owed by the client (VAT-inclusive, referral-**not** subtracted — that's the client's full bill) tied to a Deal.
- **Income** — one row per actual client payment installment (a deal can span multiple months), each optionally carrying a Green Invoice receipt reference, replacing both Income 2026+ and the ad-hoc Excel income rows.
- **AgentLedgerEntry** — replaces the Excel `data` sheet and Agent Commission board: commission credits (computed from Income × the agent's current tiered rate), expense/recurring-charge debits, and `payment_to_agent` reconciling entries — each `payment_to_agent` entry carries the two required attachments (tax invoice + Kabbala) and triggers the Drive push.
- **RecurringExpenseConfig** — replaces `agents and recurring expenses`: per-agent standing monthly charges, auto-posted by a monthly job instead of hand re-typed.
- **CommissionTier** — replaces both `חלוקת עמלות` and the hardcoded formula in the "Expense" dev board: threshold→rate table plus named per-agent overrides (e.g. the two agents flatly at 60%), as actual configurable data instead of a formula you'd have to edit to change a number. **The rate is marginal/bracket-blended, not a cliff-edge lookup** — confirmed with a worked example: an agent at ₪440k YTD who closes a ₪20k deal earns the first ₪10k (440k→450k) at 50% and the second ₪10k (450k→460k) at 55%, a blended 52.5% for that specific deal — exactly how the "Expense" dev board's nested-IF formula already does it (`IF(SUM(preVat)-preVat < 450000, ((450000-priorYtd)*50 + (cumulative-450000)*55)/dealValue, ...)`), just as real configurable data instead of a hardcoded formula. Phase 1's `resolveAgentRate`/`computeAgentCommission` in `src/lib/commission.ts` used a flat cliff-edge lookup and needs replacing with this bracket-blended version before Phase 6 — flagged there explicitly as a placeholder at the time, now confirmed important rather than deferrable.

## Green Invoice integration

Confirmed against the real API docs (Green Invoice, rebranded "Morning" — `developers.morning.co`). Two environments, each with its own client_id/secret: sandbox `https://sandbox.d.greeninvoice.co.il/api/v1` (build/test here first, per your answer) and production `https://api.greeninvoice.co.il/api/v1`.

**Auth**: OAuth2 client-credentials — `POST /idp/v1/oauth/token` with `{grant_type:"client_credentials", client_id, client_secret}` → `{accessToken, tokenType:"Bearer", expiresAt}`. Token lasts 1 hour; send `Authorization: Bearer <accessToken>` on every subsequent call; refresh when expired.

**Client lookup/create** (manual-confirm on ambiguity, per your answer): `POST /clients/search` filters by `name`/`email`/`contactPerson` only — **no phone or tax-id filter exists**, so name-only matching can be ambiguous for common Hebrew names.
- 0 matches → `POST /clients` to create (body: `name` required, plus `taxId`, `address`, `city`, `phone`, `emails[]`, etc.), store the returned `id` (GUID).
- Exactly 1 match → use it.
- 2+ matches → surface all candidates to Levi/Ariyel to pick the right one or explicitly create new — never auto-guess.
- Store the resolved Green Invoice client id on the `Deal` (new field `greenInvoiceClientId`) so repeat document creation on the same deal doesn't re-search.

**Document creation — two manual steps, per your answer (no automatic firing):**
1. **חשבון עסקה (`type: 300`)** — a button on the deal's billing screen. Request: `type: 300`, `lang: "he"`, `client: {id: greenInvoiceClientId}`, `income: [{ description, price, vatType, ... }]` (line total = `Billing.amount`), `remarks: <role-specific text>` selected by the deal's `side` (seller/buyer/renter/landlord — see "Open questions" below, the actual four text variants aren't written yet). Store the response `id` as `Billing.greenInvoiceRef` (field already existed in Phase 1's data model, unused until now).
2. **חשבונית מס (`305`) / חשבונית מס+קבלה (`320`) / קבלה (`400`)** — created later, when a client payment is actually confirmed (tied to creating the `Income` row) — Levi picks which of the three at that moment, matching "then i will create either...". Request includes `linkedDocumentIds: [Billing.greenInvoiceRef]`, `linkType: "link"`, so Green Invoice's own document trail shows it against the original 300. Store the response `id` as `Income.greenInvoiceReceiptRef` (also already anticipated in Phase 1's data model).

**Webhooks** — Green Invoice's "Document Created" webhook (configured manually in their web UI, not via API) isn't needed for this flow, since agentLedger always initiates document creation itself and gets the id back synchronously in the response. Noted as a future option only if a document is ever created *outside* agentLedger (directly in Green Invoice's own web UI) and needs to sync back in — not built now.

A sandbox "Document Created" webhook was set up 2026-08-23 pointing at `https://hook.eu1.make.com/k2pflvv2pv1nhlnr9cuecc96gaqa7j59` (configured directly in the Green Invoice web UI, not via this codebase) — currently unused by agentLedger itself, a backstop for documents created outside the app.

**Scope this phase**: admin/manager only. No agent-facing document creation or "certain constraints" logic yet — explicitly deferred per your "eventually" framing; the data model and API wrapper are agent-agnostic already, so adding a constrained agent-facing entry point later is additive, not a rework.

## Core workflows

1. **Deal enters the system** — Make.com pushes a Deals_Raw_Data item into the new system as a `Deal` at `stage: potential`, resolving `agentId` against Daf Kesher. If sikkumPigisha marked the submission incomplete, the deal is flagged `incompleteFields`, **both you and Ariyel are notified**, and it waits for manual verification before being treated as trustworthy — not a silent auto-accept.
2. **Signing → payment request** — on signing date, a reminder to send the client a payment request.
3. **Client pays** — you confirm against the bank, log the amount/date, optionally record a Green Invoice receipt reference → creates an `Income` row.
4. **Agent tax-invoice request** — an `Income` row triggers a reminder to request the agent's חשבונית מס; on upload, it's stored as the pending `payment_to_agent` entry's first attachment.
5. **Notify Ariyel** — once the tax invoice is in, the entry surfaces on a "ready to pay" dashboard (replacing the manual Daily-Report note) — still an informal nudge to Ariyel, not a login for him.
6. **Payment confirmed** — you see it land in the bank, upload the Kabbala as the second attachment, mark the entry paid → both files push to Google Drive, the agent's running balance updates.
7. **Recurring expenses & tier rollup** — a monthly job posts standing charges from `RecurringExpenseConfig`; a derived calculation keeps each agent's current `CommissionTier` rate up to date from their YTD/quarterly income sum — the same live rate that could, later, prefill sikkumPigisha's own commission-referral wizard step instead of a static Properties-board value.

## Phased build-out

- **Phase 1 (done)** — repo scaffold, temporary single-admin login, DynamoDB-shaped local dev store, data model, manual entry UI for `Deal`/`Billing`/`Income`/`AgentLedgerEntry`, per-agent running-balance dashboard. Smoke-tested 2026-08-22.
- **Phase 2 (done)** — role-based auth rework: OTP-via-Daf-Kesher login (reusing sikkumPigisha's `src/lib/auth/actions.ts`/`src/lib/waba/client.ts` pattern); session carries `{agentId, role, district}` instead of `{role:"admin"}`; split `Deal.status` into `stage`+`paymentStatus`; `notes`/`incompleteFields` added to the Deal model. Smoke-tested 2026-08-23 (real OTP login via a dev bypass for the WhatsApp-send step, resolved to admin correctly). Daf Kesher's "app role" column still doesn't exist yet — role resolution currently falls back to the "Is Team Leader" flag / a bootstrap-admin override.
- **Commission-tier math fixed (done)** — `src/lib/commission.ts`'s bracket-blended `computeMarginalCommission`/`computeMarginalRate` replaced the old cliff-edge lookup, verified 2026-08-23 against the ₪440k-prior/₪20k-deal → 52.5% worked example plus a double-bracket-crossing case. Not yet wired into any UI — that's Phase 6.
- **Phase 3** — role-scoped views: agent's own-deals-and-balance view with their permitted actions (stage advance, tax-invoice upload, notes, complete-missing-fields); team leader's team pipeline view (status only, no $); manager's cross-team view (same operational actions as admin).
- **Phase 4** — Make.com → `Deal` ingestion from Deals_Raw_Data, creating deals at `stage: potential`, resolving `agentId` against Daf Kesher and flagging `incompleteFields` from whatever sikkumPigisha marked incomplete. An incomplete deal notifies **both** Levi and Ariyel (not a passive dashboard flag) and is held for **manual verification** before being treated as fully trusted — the ingestion isn't a blind auto-accept.
- **Phase 5** — the agent-payment workflow end to end: tax-invoice upload feeding into the pending `payment_to_agent` entry's first attachment (reusing/adapting sikkumPigisha's existing Claude-vision extraction pattern for image/PDF intake), "ready to pay" surfacing for admin/manager, dual-attachment payment confirmation, Google Drive push.
- **Phase 6** — `RecurringExpenseConfig` monthly automation + `CommissionTier` rollup and dashboard, wiring in the already-fixed bracket-blended calculation.
- **Phase 7 (done — verified against real sandbox)** — Green Invoice API integration per the "Green Invoice integration" section above, built and sandbox-tested 2026-08-23 end to end: real client created via search-then-create, real חשבון עסקה (300) created, a payment logged, and a real linked קבלה receipt created against it — full chain confirmed working in the actual sandbox account, not just typecheck/build. Three real API quirks surfaced and fixed along the way (not documented anywhere in the API reference text itself, only discoverable by hitting them live):
  1. `currency` is required at the **document level**, not just per income line-item — omitting it: `"ערך קוד מטבע לא תקין"`.
  2. Receipt-type documents (305/320/400) require a `payment[]` row — a receipt is proof of an actual payment, not just a bill — omitting it: `"נא למלא לפחות שורת תקבולים אחת"`. Payment type codes (`PaymentGroup`): 1=cash, 2=check, 3=credit card, 4=bank transfer, 5=PayPal, 10=payment app, 11=other — defaulted to bank transfer (4), the realistic default for real-estate commission payments.
  3. `income[].price` must be the **pre-VAT** amount (Green Invoice adds VAT on top itself, per `vatType: 0`) while `payment[].price` must be the **VAT-inclusive** total actually paid — passing the same VAT-inclusive figure to both double-counted VAT on the income side and produced `"קיים חוסר התאמה בין סכום התקבולים לסכום התשלומים"` (income/payment total mismatch) once a payment row existed to cross-check against. Fixed by dividing by `(1 + VAT_RATE)` for the income line, reusing the same `VAT_RATE` constant from `src/lib/commission.ts`.
  
  Still needed before this goes live: production credentials (currently sandbox-only, correctly), and the four role-specific remarks texts (still TODO placeholders in `src/lib/green-invoice/remarks-templates.ts`).
- **AWS + git checkpoint (done)** — real DynamoDB tables (`agent-ledger-{deals,billing,income,ledger-entries}`, all `PAY_PER_REQUEST`, eu-north-1) + S3 bucket (`agent-ledger-attachments`) + scoped IAM user provisioned 2026-08-24, replacing the local-file dev store with identical exported function signatures. All 4 tables verified live end-to-end (UI submit → direct `aws dynamodb scan`), not just typecheck. Git repo initialized in `D:\Dev\agentLedger\app`, 3 commits, pushed to `github.com/lygold/agentaccounts` on `main`.
- **Phase 8** — feed the live commission-tier rate back into sikkumPigisha's own commission-referral wizard step (was folded into old Phase 7).

## Open questions (before Phase 7, unless noted)

- The new Daf Kesher "app role" column needs to actually exist before OTP login can resolve a role — same manual-Monday-setup dependency Phase 1's commission columns had on sikkumPigisha.
- Manager's exact permission set (assumed here: same operational actions as admin, minus user/role management) is an assumption, not something explicitly specified — worth a quick confirm once Phase 3's manager view is being built.
- Green Invoice sandbox API credentials (client_id/secret) — needed before Phase 7 starts.
- **The four role-specific Hebrew remarks texts (seller/buyer/renter/landlord) for the 300 document don't exist yet** — you'll need to supply the actual wording before Phase 7 ships; the plan reserves a `DocumentRemarksTemplates` config keyed by `DealSide` for it.
- Exact category list for expense types (office fee, מדלן, פרמי, specific ad vendors) — pull directly from `agents and recurring expenses` and the `data` sheet's `הפעולה` column before building the entry form.
- Whether the two named per-agent tier overrides (flat 60%) are permanent exceptions or something that should itself be time-bound/configurable.
- Whether you want the new system to also read Red File (read-only) during a transition period to cross-check nothing falls through the cracks while you're still partly on Excel, or a clean cutover once Phase 1 is ready.
- **Language/i18n (done 2026-08-24)** — ported sikkumPigisha's exact `next-intl` architecture into agentLedger: cookie-based locale (no URL prefix), `he`/`en` message catalogs (`messages/{en,he}.json`), RTL toggle, same top-right locale switcher. Every existing page converted (dashboard, deals list/detail/new, agent ledger, login, OTP). Build verified clean. **Known gap**: login/OTP error messages returned by server actions (`lib/auth/actions.ts` `state.message`) are still hardcoded English — not yet converted to message keys.

## Strategic direction: full migration off Monday.com (confirmed 2026-08-24)

This is bigger than the accounting rebuild alone — **Levi's stated intent is that all active Monday boards eventually get migrated out of Monday**, not just the accounting-adjacent ones (Red File, Billing/Income 2026+, Agent Commission). agentLedger (or whatever it becomes) is the target platform for that migration, board by board. First board in line: **Properties Raw Data** (`1633691694`, 304 items, ~85 columns — full schema pulled 2026-08-24: agent link, listing/contract status, full address, ~30 property-attribute columns, bilingual Hebrew+English listing copy already exists per-property, owner contact PII, referral/commission fields, 6 file columns for photos/forms).

**Decided so far:**
- Properties migrates to DynamoDB as the new source of truth (same `PAY_PER_REQUEST` + GSI pattern as deals/billing/income), not a live-read-from-Monday approach.
- Photos/files stay in Google Drive (already paid for, not stopping) — DynamoDB stores structured property data + Drive links only, not binaries.
- Cost is a non-issue at this scale: DynamoDB on-demand ballparks to a few cents–low single dollars/month for 304 items at realistic internal traffic (same order of magnitude as the existing 4 tables, which cost effectively nothing).
- New feature, confirmed: a property's page gets an action that jumps an agent straight into sikkumPigisha's deal wizard, pre-filled from that property's data.
- **Which "contacts" board migrates and when is still open** — Properties Raw Data links to TWO different client-ish boards that are easy to conflate: `contacts` (`1628089139`, 503 items, general CRM — name/phone/email/ID/address/status) and `Signed Contracts` (`1623367406`, the board sikkumPigisha's own `MONDAY_CLIENTS_BOARD_ID` already reads for its buyer/client picker). Levi's answer was "all active boards eventually," not a specific order — so this is directional, not yet a committed near-term phase.

**Not yet started**: Properties table schema/migration script, property list/detail UI, agent-facing property view + edit permissions, the sikkumPigisha pre-fill handoff, and any contacts-board work. This needs its own scoping pass (own phase numbering) before building — it's a meaningfully larger effort than the accounting-only Phases 3-8 above, and touches sikkumPigisha too (the pre-fill handoff is cross-repo).

## Multi-tenancy (confirmed goal 2026-08-27, not yet built)

Levi confirmed a two-horizon plan: **near-term** — he may own a second office, needing office-level data separation within agentLedger. **Long-term** — sell agentLedger as a product to other real estate agencies, which he confirmed he's fine decoupling from Monday.com entirely for (this was already the direction per the "all boards migrate out of Monday" note above — now explicitly tied to a commercial multi-tenant goal, not just an internal-tooling preference).

**Why this matters for everything being built now:** the current data model (Deal/Billing/Income/AgentLedgerEntry, and the not-yet-built Properties/Contacts tables) has no `officeId`/tenant field anywhere, and identity/auth is hard-wired to one specific Monday.com workspace's board schema (Daf Kesher). Retrofitting a tenant key after real production data accumulates is much more painful than building it in now, while the only data in these tables is test rows. **Recommendation going forward: every new table/field added from here on should carry an `officeId` (or `tenantId`) from day one** — including the Properties migration whenever that starts — even though only one office exists today. The harder, separate piece — decoupling identity/auth from Monday's specific board schema so a different agency (with no Monday account at all) could onboard — is real work, not a column addition, and doesn't need to happen for the second-office case, only for the sell-as-a-product case.

**`officeId` retrofit done 2026-08-27** — Levi chose to add it now rather than wait. `src/lib/office.ts` exports `DEFAULT_OFFICE_ID` (env `OFFICE_ID`, falls back to `"remax-jerusalem"`); `officeId: string` added to `Deal`/`Billing`/`Income`/`AgentLedgerEntry`/`RecurringExpenseConfig`/`CommissionTierOverride` in `types.ts`; `SessionPayload` (`session.ts`) now carries `officeId`, set at login time in `auth/actions.ts` from `DEFAULT_OFFICE_ID`; every Server Action that creates a Deal/Billing/Income/AgentLedgerEntry (`deals/actions.ts`, `agents/[agentId]/actions.ts`) now stamps `officeId: session.officeId` instead of leaving the session's return value discarded. No DynamoDB schema change needed (it's schemaless — the new attribute just gets stored on new items); `npm run build` passes clean.

**Deliberately NOT done yet, needs AWS access to close out**: no `byOfficeId` GSI exists on any of the 4 tables — with a single office there's nothing to query-scope by yet, and the AWS CLI in this environment currently has no credentials (user logged it out 2026-08-24, said he'd hand over new ones "when I need"). When office #2 actually happens: add a `byOfficeId` GSI to each table (additive, non-destructive, doesn't require recreating the table) and add `listDealsByOffice`-style query functions — flagged here so it isn't forgotten, not urgent while single-tenant.

Also still not addressed (out of scope for this pass): Green Invoice credentials are a single client_id/secret pair in env vars, not per-office — a second office (with its own Green Invoice/tax account) would need per-office credential lookup instead of one fixed env pair. Noted for whenever office #2 is real, not built now.

## Verification

This is a roadmap, not an implementation plan — Phase 7 (Green Invoice) gets its own verification once built: sandbox-only smoke test creating a real 300 for a test client, then a linked 305/320/400 against it, confirming the linked-document chain shows correctly in Green Invoice's own UI before ever pointing this at production. Phase 3 (role-scoped views), once built, needs its own check that each role actually sees/can-do only what's specified above (e.g. log in as an agent and confirm you cannot see another agent's balance).
