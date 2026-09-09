# Agent Ledger — Roadmap

The single source of truth for where this project is going. Code comments that
say "see the roadmap plan" / "see the Agent Hub plan" mean this file.

---

## 1. What this is

A standalone, multi-office SaaS for real-estate agencies to run the **agent side
of the books**: deals → billing → income → per-agent commission ledger, with
Green Invoice (Morning) document creation and WhatsApp/email OTP login.

It started as an internal tool for **RE/MAX Jerusalem**, replacing a tangle of
Monday.com boards ("Red File", "Daf Kesher", commission sheets). The end state is
a product other independent offices can use, each fully isolated from the others.

---

## 2. Architecture principles

1. **Multi-tenant from day one.** Every table row and every session carries
   `officeId`. This was true before a second office existed specifically so that
   onboarding office #2 is a config change, not a data migration.
2. **The app owns its own data.** No runtime dependency on external boards for
   core entities. Monday.com is an *import/sync source during migration only*,
   then decommissioned — same path every other Monday board is on.
3. **Service layer holds business logic.** `src/lib/services/*` are plain
   functions (no auth, no FormData, no redirect). Server actions and any future
   WhatsApp/API handlers are thin callers.
4. **Isolation is enforced at the data layer**, not the UI. Every read is
   office-scoped; every write asserts `row.officeId === session.officeId`.
5. **Config is per-office**, not global. VAT rate, commission tiers, Green
   Invoice credentials, branding, locale — all live on the office record.
6. **Functionality first, then a dedicated design pass.** Don't re-polish after
   every feature.

---

## 3. Status — what's built

| Phase | Scope | State |
|---|---|---|
| **0** | Deploy prep: DynamoDB tables, Amplify compute role, Node 22 pin, `create-tables.mjs` | ✅ done |
| **1** | Core ledger on DynamoDB: deals / billing / income / agent-account, generic store helpers | ✅ done |
| **2** | Green Invoice integration (client resolve/create, 300 account, receipts); i18n (he/en) | ✅ done |
| **3** | Role-based access (manager-only writes; agent/team-leader read-only), VAT-aware ledger, auto-commission (bracket-blended by YTD tier), service-layer extraction | ✅ done |
| **3.5** | Deploy hardening: server env baked into the build for Amplify SSR (`next.config.ts`), IAM policy fixes, login flow verified end-to-end in prod | ✅ done |

**Known debt carried forward:**
- Identity is currently read from the Monday "Daf Kesher" board (read-only).
  Roles come from a Monday column **that does not exist yet** — so everyone
  resolves to `agent` unless `BOOTSTRAP_ADMIN_PHONE/EMAIL` matches.
- `src/lib/auth/scope.ts` matches agents by **name string**, not ID.
- Queries are **not office-scoped** — `listAll()` is a raw table scan; the
  balances dashboard sums every row regardless of office.
- Commission tiers (`commission-tiers.ts`) and Green Invoice creds are global
  constants / env, not per-office.
- Intermittent Amplify SSR platform error on server-action redirects
  (`ERR_SSL_WRONG_VERSION_NUMBER`) — does not block the flow.

---

## 4. Upcoming phases

### Phase 4 — Agents table + admin management + Daf Kesher decommission

**Goal:** the app owns its agent directory. Admins manage agents in-app. Monday
"Daf Kesher" goes through a 2-way sync, then is switched off.

- **New `agents` table** (DynamoDB), keyed by `id` (UUID), GSI `byOfficeId`:
  `officeId`, `name`, `email`, `phone`, `role` (`agent | team_leader | manager |
  admin`), `teamId`/`district`, `status` (`active | archived`),
  `mondayItemId?` (migration link), `createdAt`, `updatedAt`.
- **Auth switches to this table.** `findAgentByContact` reads `agents`, not
  Monday. `roles.ts` reads `role` from the row (the pending Monday column
  problem disappears). `BOOTSTRAP_ADMIN_*` stays as break-glass.
- **Admin UI** (`/admin/agents`, admin-only):
  - list agents **in the admin's own office**
  - add (name / email / phone / role / team)
  - edit
  - **archive** (soft) — blocks login, hides from pickers, balance still
    viewable. **Hard-delete only when zero deals + zero ledger entries reference
    the agent.**
- **Fix `scope.ts`** to match by `agentId`, and denormalise `agentId` +
  `teamId` onto deals/ledger entries going forward. Backfill old rows by name.
- **Daf Kesher 2-way sync (temporary):**
  1. **Import**: one-time pull of the RE/MAX Jerusalem roster into `agents`
     (`scripts/import-agents-from-monday.mjs`), setting `mondayItemId`.
  2. **Sync window**: while both systems are live, a small sync job keeps
     name/phone/email in step (Monday → app on a schedule; app → Monday on
     write, via the Monday API which supports item create/update/archive).
  3. **Cutover**: announce, freeze Monday edits, final sync, flip the app to
     `agents`-only, remove `src/lib/monday/*` and the `MONDAY_*` env vars.
- **Decommission checklist** (section 6).

**Open decisions — "what happens on add / archive":**
- Archived agent with an **outstanding balance** → freeze visible, or require
  settlement first?
- Their **open deals** → reassign to another agent, or leave frozen?
- Their **recurring expenses** (office fees) → auto-stop on archive?
- **Re-adding** a previously archived agent → reactivate same record, or new?
- Who can create an **admin**? (only another admin; only the office owner?)

### Phase 5 — Multi-tenancy hardening

**Goal:** true isolation. Office A's admin cannot reach office B's data by any
path.

- **New `offices` table**: `id`, `name`, `ownerAgentId`, `status`/`plan`,
  `branding` (see Phase 7), `settings`:
  - `vatRate`
  - `commissionTiers` (move `commission-tiers.ts` here — per-agent overrides
    too)
  - `greenInvoice` — **each office has its own Morning account**; creds move
    off env onto the office record (encrypted at rest)
  - `defaultLocale`, `dealIntakeUrl`
- **Every table gets a `byOfficeId` GSI.** Replace every `listAll()` scan with
  an office-scoped query. **Ban unscoped `listAll`** (lint rule or delete the
  helper).
- **Write-time assertion** in the store layer: `row.officeId === ctx.officeId`
  or throw. Defense in depth on top of query scoping.
- **`listAgentBalances`, deals list, ledger** — all filtered to
  `session.officeId`.
- **Platform super-admin** — a separate `platformAdmin` flag (you, for
  support), outside normal office scope, used sparingly and audited.
- Remove the last global Monday lookup (`listAgentNamesInDistrict` → query the
  `agents` table by `teamId` within office).

**Open decision:** can one **customer** own multiple offices (a franchise with
branches) and want a combined view? Default plan: **no — office = tenant, keep
it flat.** Add an `org` layer above `office` only when a real customer needs it.

### Phase 6 — Standalone auth & office onboarding

- Office creation flow: create `offices` row → create its first `admin` agent →
  they invite the rest. Manual/scripted first (`scripts/create-office.mjs`),
  self-serve later.
- Invite / first-login flow for new agents (currently login assumes the contact
  already exists).
- Session already carries `officeId` — confirm it's the hard tenant boundary
  everywhere.
- Audit log per office.

### Phase 7 — Design pass + per-office branding

- **Design pass** (its own phase, deliberately late): layout system, data
  density, KPI cards, charts, empty/loading/error states, responsive, RTL
  polish. Professional dashboard, not a raw CRUD app.
- **Per-office branding — scoped, cheap version only:**
  - office record holds: `logoUrl`, `primaryColor`, `accentColor`,
    `displayName`
  - at session load, inject a `<style>` overriding the CSS design tokens on
    `<html>`; swap the nav logo
  - **not** in scope: custom fonts, layout variants, a full theming engine
- Build the token layer in the design pass with this hook already in place, so
  branding is not a retrofit.

### Ongoing / later

- WhatsApp deal handler (the service layer was shaped for this).
- Overdue / dead-debt payment workflows.
- Recurring-expense automation.
- Reporting exports.

---

## 5. Open decisions (consolidated)

| # | Question | Default lean |
|---|---|---|
| D1 | Archived agent with outstanding balance | Freeze visible, no forced settlement |
| D2 | Archived agent's open deals | Reassign on archive (admin picks) |
| D3 | Archived agent's recurring expenses | Auto-stop |
| D4 | Re-adding an archived agent | Reactivate same record |
| D5 | Who can create an admin | Another admin only |
| D6 | One customer, multiple offices | No — office = tenant, flat |
| D7 | Platform super-admin scope | Read-all + impersonate, fully audited |

---

## 6. Monday.com decommission checklist

Applies to **Daf Kesher** (board `1593085910`) — the last Monday board this app
touches. Other boards (Red File, commission sheets) are already replaced by the
DynamoDB model.

- [ ] `agents` table live, admin UI shipped (Phase 4)
- [ ] Roster imported from Monday, `mondayItemId` set on each row
- [ ] Sync job running both directions, verified for one full week
- [ ] Auth (`findAgentByContact`, `roles.ts`) reads `agents`, not Monday
- [ ] `scope.ts` matches by `agentId`
- [ ] Announce cutover date to the office
- [ ] Freeze Monday edits → final sync → flip app to `agents`-only
- [ ] Delete `src/lib/monday/*`
- [ ] Remove `MONDAY_API_TOKEN`, `MONDAY_AGENTS_BOARD_ID` from env +
      `next.config.ts` `SERVER_ENV_KEYS`
- [ ] Note: the *other* app (sikkumPigisha) also reads this board — coordinate,
      or leave the board read-only for it until that app migrates too
