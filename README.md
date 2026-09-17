# agentLedger

A standalone, multi-office SaaS for real-estate agencies to run the agent
side of the books — deals → billing → client income → per-agent commission
ledger → the office's daily accounting report — plus Green Invoice document
creation, WhatsApp/email OTP login, a deal-intake wizard, and a native
property-listing wizard. Built for **RE/MAX Jerusalem** as the pilot office,
replacing a sprawl of Monday.com boards, a separate 18-step wizard app, three
external client-signing programs, Green Invoice, and two hand-maintained
Excel workbooks.

**Live**: `https://main.d2aqfzo6esnq4n.amplifyapp.com` (AWS Amplify,
auto-deploys on push to `main`).

> **The canonical plan and full history is [`ROADMAP.md`](ROADMAP.md).** This
> file is a fast-orientation snapshot; where the two disagree, ROADMAP.md wins.

## What's live today

- **Deal ledger**: OTP login, role-scoped dashboard/deals/per-agent ledger,
  deal creation with auto-billing, log-payment → auto-commission (bracket-
  blended by YTD tier).
- **Green Invoice**: production integration — client resolve/create, חשבון
  עסקה (300), receipts (305/320/400) via webhook + poll fallback, agent
  monthly expenses (recurring + bulk import) billed through GI.
- **Daily accounting report** (`/reports/daily`) — the office's north-star
  report: agent ledger movement, bank reconciliation, RE/MAX Israel receipts.
- **Deal-intake wizard** (`/deals/new`, 18 steps + AI document-upload
  extraction) — replaced the old external sikkumPigisha app.
- **Native property-listing wizard** (`/properties/new`, full field parity
  with the old external Superform) — deal type → signed-contract picker
  (auto-filling owner/address/commission) → address (Google Places) →
  commission/exclusivity → property details → media (Google Drive) →
  descriptions → technical details → internal ratings → review.
- **Property management**: status/detail/edit pages
  (`/properties/[id]`, `.../edit`), any edit triggers a secretary
  notification (in-app feed + email/WhatsApp, each independently toggleable).
- **Exclusivity Gantt** — `/properties` is the default view: a lightweight
  custom Gantt chart of active exclusivities (color-banded by how much of
  the exclusivity period has elapsed), haskama-only listings listed below,
  All/Sales/Rental tabs. The flat list is the alternative view, at
  `/properties/list`.
- **Monday.com sync bridge for properties** — two-way: inbound daily cron
  pulls Properties Raw Data into the app; outbound mirrors new
  wizard-created listings back to Monday. (Same bridge pattern already
  live for agents since Phase 4.)

## What's in progress / not started

- **Property edit gaps**: media and internal-ratings editing aren't on the
  edit page yet.
- **Gantt polish**: flagged by the office as "a bit rough" (dates/display) —
  no specifics pinned down yet. A separate, unrelated CSS bug — an
  exclusivity end-date label overlapping the owner-name area on some
  property page — is also open (exact page not yet identified).
- **Mobile optimization** — explicitly deferred, not started. Agents mostly
  use mobile; managers mostly use a PC.
- **Team/neighbourhood performance stats** — planned (see ROADMAP.md's
  Phase 9 section), blocked on the office providing a neighbourhood→team
  mapping. No code written yet.
- **Offers board, referrals board, cross-board automation, and the "important
  reports" list** — discussed as the next MVP milestone, not scoped in
  detail or started.
- **Phase 9's Monday sync bridge scope limit**: only address/owner/
  commission/dealType/rooms/size/price round-trip with Monday — media,
  descriptions, technical details, and ratings don't sync either direction.
- Everything else not listed above that ROADMAP.md marks ⏳ or unstarted —
  in particular Phase 8f (sikkumPigisha decommission), Phase 10 (full Monday
  decommission), and Phase 11 (design pass + per-office branding).

## Running locally

See [`docs/reference/running-locally.md`](docs/reference/running-locally.md)
for dev setup, the OTP bypass code, required tables, and what needs to be
reachable. Quick version:

```bash
npm install
npm run dev
```

Requires `.env.local` (see `.env.example`) — DynamoDB table names + AWS
creds, Green Invoice sandbox creds, Monday API token, Google Places/Drive
credentials, Redis (Upstash) URL/token. Verify before pushing:

```bash
npx tsc --noEmit && npx next lint && npx next build
```

## Repo layout

- **Git repo root is this directory** (`app/`, not its parent).
  Remote: `github.com/lygold/agentaccounts`, branch `main`.
- `src/app/` — Next.js App Router pages + server actions.
- `src/lib/` — business logic (`services/`), data access (`store/`), the
  deal wizard (`wizard/`) and property wizard (`property-wizard/`),
  Monday.com client (`monday/`, `wizard/monday/`), Green Invoice
  (`green-invoice/`), auth (`auth/`).
- `scripts/` — one-off/maintenance scripts (table creation, migrations,
  seeding, imports) — see each file's header comment for usage.
- `docs/reference/` — narrow, accurate topic notes (running locally, role
  scoping, commission calc, the Weiser import, etc.).
- `docs/archive/` — superseded planning docs, kept for historical detail.
- `docs/mem/` — implementation-detail notes for specific subsystems (GI
  webhook shape, bank export format, office expenses model, etc.).

## Architecture principles (see ROADMAP.md §2 for the full list)

Multi-tenant from day one (every row/session carries `officeId`); the app
owns its own data (Monday is an import/sync bridge *during migration only*,
then fully decommissioned); business logic lives in a plain service layer,
not in route handlers; isolation enforced at the data layer, not the UI;
Green Invoice and the bank are the source of truth for money, not typed
numbers.
