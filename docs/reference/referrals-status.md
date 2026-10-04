---
name: referrals-status
description: "Referral handoff feature (Phase 9) — what's confirmed working, what's confirmed broken, and what's still unverified in production, as of 2026-10-04."
metadata:
  type: project
  modified: 2026-10-04
---

**Read this before trusting any other referrals doc/comment about what this
feature does.** Built fast over a long, multi-day session with a lot of live
production debugging. This revision supersedes the 2026-09-24 version of
this doc below: everything that was reverted that day (commit `5e3423a`)
was reapplied the same evening (`9388bdd`, `a22cd8c`, `7d42d6f`) and has
been live on `main` since. The feature was finished with a separate
`feature-refferals` branch and merged into `main` on 2026-09-28 (`e6bd09e`),
alongside the unrelated offers feature — see
`docs/reference/offers-status.md`.

## What this replaces

The Monday.com "Referrals" board (id `5092845827`) and its two Make.com
scenarios — an agent handing a client off to another agent, gated by a
25%-fee consent step before contact details are released. **Not** the same
thing as the `referrals` table description elsewhere in ROADMAP.md's Phase 9
section — that's a *different* concept (% of commission owed to an external
referrer once a deal closes). This feature reuses the same physical
`agent-ledger-referrals` table (it was sitting unused) but the two concepts
are deliberately kept separate for now; see the doc comment on
`ReferralRecord` in `src/lib/types.ts`.

## Confirmed working (someone actually tested it and it worked)

- **Creating a referral** — `/referrals/new`: direction, client info,
  either a picker (internal agent) or hand-typed fields (external
  agent/office) depending on direction. A `dealId`-as-explicit-`NULL` write
  bug (DynamoDB rejects a GSI key attribute written as `NULL` rather than
  simply absent) was fixed in `ad68fcc`.
- **The WhatsApp invite send** — `outgoing_referrals_approval` template,
  fixed to use Meta's named-parameter format (`parameter_name`, not
  positional `{{1}}`) which the original build got wrong.
- **The `/r/[id]` consent page loading and being reachable** — required two
  separate fixes: (1) the button URL in Meta Business Manager had to be
  repointed from the old Fillout form to this app, and (2) `/r/` had to be
  added to `src/middleware.ts`'s `PUBLIC_PATHS` — it was gating this
  public page behind a login redirect entirely.
- **`/referrals` list page** loads and shows created referrals; a nav link
  to it was added (`56ad915`).
- **The details message** (`outgoing_referral_details`, sent after
  accepting) and **the accepted-confirmation message**
  (`outgoing_referral_update_agent_on_acceptance`) to the sending agent —
  both fixed in `7d42d6f` (root causes: an empty-string `clientEmail` param
  Meta rejects, and the accepted-template having grown a 3rd `{{status}}`
  var in Meta Business Manager the code hadn't caught up to). Code executes
  cleanly end to end (zero errors in logs); **actual WhatsApp delivery to
  the recipient is unconfirmed/disputed** — a report of "didn't receive it"
  came in after the fix was live and was never independently resolved.
- **`/referrals/[id]`** — the referral detail/lead-management page
  (read-only client info, free-text lead status + quick-set buttons,
  append-only check-in activity log) and showing the counterpart's
  phone/office/email on it — both reapplied in `9388bdd` after the
  2026-09-24 revert, confirmed working again (`5001ef5` fixed a crash when
  `leadStatus`/`activityLog` are absent on older rows).

## Confirmed broken

- **The Monday outbound mirror** (`src/lib/sync/referrals.ts`,
  `mirrorReferralToMonday`) — **confirmed broken**:
  `MONDAY_REFERRALS_BOARD_ID` isn't set, confirmed via live logs. Every
  referral-affecting action hits this — creation (`referrals/new/
  actions.ts`) and accept/decline (`r/[id]/actions.ts`) all fire a
  `void mirrorReferralToMonday(...)` call that throws `MondayConfigError`
  and dead-letters to Redis. Fire-and-forget by design, so this doesn't
  block the app-side flow, but staff watching the Monday board during the
  transition see nothing land there. The two native Monday automations on
  that board (which would double-fire the old Fillout flow if left on)
  were also **never confirmed turned off** — check both before relying on
  the mirror once the board ID is set.
- **Quick-set lead-status buttons on `/referrals/[id]` still clear the
  status instead of setting it** — confirmed still present in current
  code. `updateReferralLeadStatus` in `src/app/referrals/[id]/actions.ts`
  parses the submitted form via `Object.fromEntries(formData.entries())`.
  The single `<form>` in `src/app/referrals/[id]/page.tsx` has *two* fields
  both named `leadStatus` — the quick-set buttons (`name="leadStatus"
  value={...}` on each `<Button type="submit">`) and the free-text
  `<Input name="leadStatus">` below them. `Object.fromEntries` keeps the
  *last* duplicate key it sees, and the empty free-text input always sits
  after the buttons in the DOM, so its empty string always wins over
  whichever button was actually clicked — saving `leadStatus: null` every
  time. Fix needs the two controls to stop sharing a form-field name (or
  the action to dedupe/prefer the clicked control before zod-parsing).
  Not fixed.

## Built, but NOT confirmed working in production

- **Broker (Ariel) notification on referral creation**
  (`src/lib/services/referral-notify.ts`) — `BROKER_PHONE`/`BROKER_EMAIL`
  still unset; the code no-ops gracefully (logs and skips) rather than
  failing, but was never tested against a real contact.
- **The 48-hour auto-expiry cron** (`src/lib/services/referral-expiry.ts`,
  `.github/workflows/expire-referrals.yml`) — deployed, never observed
  actually firing.
- **The consent evidentiary record** (`respondedAt`/`respondedIp`/
  `consentTextShown` on `ReferralRecord`) — code looks right, never
  independently verified by actually disputing a real acceptance.

## Known product gap

- **Lead status has no history** — typing a new status just overwrites the
  old one in place (this part is as-designed: `leadStatus` is a single
  current-value field, not a log). But nothing records *that it changed*
  anywhere, including the separate append-only "Activity log" section
  right below it on the same page — a status change and a check-in note
  are two disconnected things today. Worth deciding whether a status
  change should auto-append an activity-log entry. Not fixed.

## Known unrelated issue, discovered along the way

Intermittent `ERR_SSL_WRONG_VERSION_NUMBER` on `fetch()` calls to Upstash
Redis from the Amplify Lambda compute — roughly 1 in 4-5 requests in one
observed CloudWatch sample. Classic Lambda-freeze + stale-keep-alive-
connection-reuse pattern with `fetch`/undici-based clients. Hits both this
feature and offers unpredictably (also noted in ROADMAP.md §3's "known
debt"). Not caused by anything in this session's work. No fix attempted —
would mean wrapping affected calls in a retry-once-on-network-error, or
disabling keep-alive for that client. Worth fixing if it starts causing
visible user-facing failures, not urgent otherwise.

## Repo hygiene note

`main` is the only branch on GitHub (`origin`) now — `feature-offer` and
`feature-refferals` were deleted remotely after merging. **Stale local
worktrees for them still exist on disk** and are behind current `main`:
`D:\Dev\agentLedger\agent-ledger-feature-offers` (`feature-offer` @
`6f05bff`) and `D:\Dev\agentLedger\agent-ledger-feature-referrals`
(`feature-refferals` @ `5228e2a`). Don't develop from either without first
checking how far behind they are.

## Earlier history (2026-09-23/24), superseded above but kept for context

Everything built in this window (template unification, the referral
detail/lead-management page, phone/office display on it, the WhatsApp
delivery-status webhook) was **reverted on 2026-09-24** (`5e3423a`,
"Revert to last confirmed-working state") after debugging the webhook
opened an unrelated rabbit hole (the Redis/SSL flakiness noted above — real,
but unrelated to referrals). The detail page, phone/office display, and
template unification were **reapplied the same evening** (see "Confirmed
working" above) and have been live since. The webhook was **not**
reapplied:

- `/api/webhooks/whatsapp` + `/admin/whatsapp-debug` — a Meta WhatsApp
  status-callback webhook for debugging actual delivery (vs. just "Meta's
  API returned 200"). Needs `META_APP_SECRET` (real Meta secret) and
  `META_WEBHOOK_VERIFY_TOKEN` (arbitrary shared string) to work; neither
  is required by anything else, safe to leave unset. Still in git history
  (pre-revert commits), can be reapplied deliberately later.
- The `amplify.yml` build-env whitelist fix for `BROKER_`/`META_APP_SECRET`/
  `META_WEBHOOK_VERIFY_TOKEN` — **note: while investigating this, it was
  confirmed the whitelist's grep pattern doesn't actually match ANY
  prefix-style variable** (`UPSTASH_`, `MONDAY_`, `META_WABA_`, etc. all
  fail to match the pattern's literal trailing `=`, tested directly with
  `grep -E`, exit code 1 either way). This `.env.production`-writing build
  step has apparently been a no-op for every prefix-style variable since it
  was originally written — whatever actually gets these values into the
  running app doesn't go through it. Not re-verified in this pass; not
  urgent to fix (nothing currently depends on it), but worth knowing next
  time someone's tempted to "fix" this step and expects it to change
  runtime behavior.
