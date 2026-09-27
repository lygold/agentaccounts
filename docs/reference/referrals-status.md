---
name: referrals-status
description: "Referral handoff feature (Phase 9) — what's confirmed working, what's built but unverified, and what was reverted after the WhatsApp-debugging session on 2026-09-24."
metadata:
  type: project
  modified: 2026-09-24
---

**Read this before trusting any other referrals doc/comment about what this
feature does.** Built fast over one long session with a lot of live
production debugging; this is the honest state as of the revert, not the
aspirational one.

## What this replaces

The Monday.com "Referrals" board (id `5092845827`) and its two Make.com
scenarios — an agent handing a client off to another agent, gated by a
25%-fee consent step before contact details are released. **Not** the same
thing as the `referrals` table description elsewhere in ROADMAP.md's Phase 9
section (line ~610) — that's a *different* concept (% of commission owed to
an external referrer once a deal closes). This feature reuses the same
physical `agent-ledger-referrals` table (it was sitting unused) but the two
concepts are deliberately kept separate for now; see the doc comment on
`ReferralRecord` in `src/lib/types.ts`.

## Current commit: `76c51b0`

Everything built after this commit (template unification, the referral
detail/lead-management page, phone/office display on it, the WhatsApp
delivery-status webhook) was **reverted on 2026-09-24** — commit
`5e3423a`, "Revert to last confirmed-working state." None of that later
work was confirmed working, and debugging the webhook opened an unrelated
rabbit hole (intermittent Redis/SSL connection flakiness under Lambda —
real, but unrelated to referrals, and not caused by any of this work). The
reverted commits are still in git history and can be reapplied
deliberately later; see "What got reverted" below.

## Confirmed working (someone actually tested it and it worked)

- **Creating a referral** — `/referrals/new`: direction, client info,
  either a picker (internal agent) or hand-typed fields (external
  agent/office) depending on direction.
- **The WhatsApp invite send** — `outgoing_referrals_approval` template,
  fixed to use Meta's named-parameter format (`parameter_name`, not
  positional `{{1}}`) which the original build got wrong.
- **The `/r/[id]` consent page loading and being reachable** — required two
  separate fixes: (1) the button URL in Meta Business Manager had to be
  repointed from the old Fillout form to this app, and (2) `/r/` had to be
  added to `src/middleware.ts`'s `PUBLIC_PATHS` — it was gating this
  public page behind a login redirect entirely.
- **`/referrals` list page** loads and shows created referrals.

## Built, but NOT confirmed working in production

- **The details message** (`outgoing_referral_details`, sent after
  accepting) — last report was "didn't receive it." Never independently
  re-verified after the middleware fix, so unclear if it's actually broken
  or just wasn't retested with a clean flow.
- **The accepted-confirmation message** (`outgoing_referral_update_agent_on_acceptance`)
  to the sending agent.
- **The 48-hour auto-expiry cron** (`src/lib/services/referral-expiry.ts`,
  `.github/workflows/expire-referrals.yml`) — deployed, never observed
  actually firing.
- **The Monday outbound mirror** (`src/lib/sync/referrals.ts`) — code
  exists, never confirmed an item actually lands correctly on the Monday
  board. The two native Monday automations on that board (which would
  double-fire the old Fillout flow if left on) were **never confirmed
  turned off** — check before relying on the mirror.
- **Broker (Ariel) notification on creation** — `BROKER_PHONE`/
  `BROKER_EMAIL` were never actually set to a real contact and tested.
- **The consent evidentiary record** (`respondedAt`/`respondedIp`/
  `consentTextShown` on `ReferralRecord`) — code looks right, never
  independently verified by actually disputing a real acceptance.

## What got reverted (still in git history, not currently live)

- Unifying accepted/declined/expired into one WABA template call
  (`sendReferralStatusTemplate`) using Levi's updated `{{status}}`
  variable on `outgoing_referral_update_agent_on_acceptance` — replaced
  what was originally two separate template functions.
- `/referrals/[id]` — a referral detail/management page: read-only client
  info, a free-text lead status field with quick-set buttons, an
  append-only check-in activity log.
- Showing the counterpart's phone/office/email on that detail page (was
  only showing the name).
- `/api/webhooks/whatsapp` + `/admin/whatsapp-debug` — a Meta WhatsApp
  status-callback webhook for debugging actual delivery (vs. just "Meta's
  API returned 200"). Needs `META_APP_SECRET` (real Meta secret) and
  `META_WEBHOOK_VERIFY_TOKEN` (arbitrary shared string) to work; neither
  is required by anything else, safe to leave unset.
- Red required-field markers on the `/referrals/new` form.
- The `amplify.yml` build-env whitelist fix for `BROKER_`/`META_APP_SECRET`/
  `META_WEBHOOK_VERIFY_TOKEN` — **note: while investigating this, it was
  confirmed the whitelist's grep pattern doesn't actually match ANY
  prefix-style variable** (`UPSTASH_`, `MONDAY_`, `META_WABA_`, etc. all
  fail to match `^(UPSTASH_|...)='s literal trailing `=`, tested directly
  with `grep -E`, exit code 1 either way). This `.env.production`-writing
  build step has apparently been a no-op for every prefix-style variable
  since it was originally written — whatever actually gets these values
  into the running app doesn't go through it. Not urgent to fix (nothing
  currently depends on it), but worth knowing next time someone's tempted
  to "fix" this step and expects it to change runtime behavior.

## Known unrelated issue, discovered along the way

Intermittent `ERR_SSL_WRONG_VERSION_NUMBER` on `fetch()` calls to Upstash
Redis from the Amplify Lambda compute — roughly 1 in 4-5 requests in one
observed CloudWatch sample. Classic Lambda-freeze + stale-keep-alive-
connection-reuse pattern with `fetch`/undici-based clients. Not caused by
anything in this session's work, was very likely already happening at a
low rate before anyone was looking closely at raw logs. No fix attempted —
would mean wrapping Redis calls in a retry-once-on-network-error, or
disabling keep-alive for that client. Worth fixing if it starts causing
visible user-facing failures (a flaky OTP login, say), not urgent
otherwise.
