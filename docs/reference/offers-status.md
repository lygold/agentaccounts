---
name: offers-status
description: "Purchase-offer feature (Phase 9) — known gaps, dormant infrastructure, and planned-but-undecided work."
metadata:
  type: project
  modified: 2026-10-04
---

Companion to the `offers` bullet in ROADMAP.md's Phase 9 section — that
covers what the feature is; this tracks what's still open.

Fully merged to `main` and deployed as of 2026-09-28 (`e6bd09e`), alongside
the referrals feature (see `docs/reference/referrals-status.md`).

## Fixed since first deploy (2026-09-27/28)

Sourcing the RE/MAX logo and the first real production traffic exposed a
string of real bugs, all fixed the same two-day window:

- **pdfkit `MODULE_NOT_FOUND` crash on every single submission** —
  `@react-pdf/renderer`'s pdfkit internals load their "Helvetica" standard
  font via a dynamic `require()` Next's build-time file tracing can't see,
  so those files never made it into Amplify's Lambda bundle. Fixed by
  `outputFileTracingIncludes` in `next.config.ts` (forces
  `pdfkit/js/standard-fonts/**`, `public/fonts/**`, and
  `public/remax-logo.png` into the trace explicitly).
- **Intermittent `ENOENT` reading `public/fonts/*.ttf` in production** —
  `process.cwd()` resolves to `/tmp/app` in Amplify's SSR compute, which
  isn't reliably populated by the time the first post-cold-start request is
  handled. `src/lib/app-asset-path.ts` now resolves asset paths against
  `/var/task` (Lambda's own deployment root, populated before the handler
  ever runs) instead, falling back to `process.cwd()` only in local dev.
- **RE/MAX logo sourced** (`public/remax-logo.png`) and wired in — working
  in the generated PDF (`src/lib/offers/pdf/render.tsx`) and on the
  post-submit thank-you page (`src/app/offer/[token]/page.tsx`, the
  `offer.submittedAt` branch).
- **`APP_BASE_URL`'s fallback domain was pointing at a different app**
  (sikkumPigisha) — corrected in `src/lib/office.ts` to this app's own
  Amplify domain, matching `DEAL_INTAKE_URL`'s fallback.
- **`DYNAMODB_TABLE_OFFERS` and `NEXT_PUBLIC_APP_URL` are now set** in
  Amplify's env vars for `main` (were missing, which would have blocked
  deploy / broken the buyer link).
- **Blank negotiation-term fields omitted from the PDF** — previously
  rendered the label with nothing under it; `LabelValue` in
  `src/lib/offers/pdf/offer-document.tsx` now returns `null` when there's
  no value.
- **"My property doesn't appear" manual-entry flow** added to
  `/offers/new` (`offer-new-form.tsx`) — lets the agent hand-type the
  address/owner when the property picker comes up empty, instead of being
  stuck.

## Known gaps

- **Logo still missing on the pre-fill buyer form page itself** —
  `src/app/offer/[token]/page.tsx` only renders the logo in the
  `offer.submittedAt` (thank-you) branch; the earlier branch, where the
  buyer actually fills in and signs the offer, has none.

## Dormant infrastructure (present, not called anywhere)

- **`src/lib/short-io.ts`** — `shortenUrl()` for Short.io's link API. Levi
  wants the offer buyer links shortened eventually (the raw
  `/offer/[token]` URL "looks wild") but hasn't decided the exact
  domain/scope. Env vars (`SHORT_IO_API_KEY`/`SHORT_IO_DOMAIN`) are already
  in `.env.example` and `next.config.ts`'s bake-into-bundle whitelist, so
  wiring it in later is just a call site + a decision, not a setup task.
  Confirmed still dormant — no references outside its own file.

## Planned, not built

- **24h auto-transition to `follow_up`.** Per Levi (2026-09-27): an offer
  still sitting in `new` — i.e. the buyer either never opened/signed the
  link, or the agent hasn't moved it off `new` — should automatically flip
  to `follow_up` after 24 hours. Same shape as the referrals feature's
  48-hour auto-expiry (`src/lib/services/referral-expiry.ts` +
  `.github/workflows/expire-referrals.yml`) would be the natural pattern
  to copy: a cron-triggered sweep plus a lazy defensive check on read.
  **Explicitly undecided, needs Levi's answer before building further:**
  what happens *after* `follow_up`? Does it just sit there indefinitely,
  does a second timer move it somewhere else (`rejected_not_relevant`?),
  does the agent get notified, does the buyer's link expire at some point
  distinct from this status change? Don't build past the 24h→follow_up
  transition itself until that's answered. Still not built as of
  2026-10-04.

## Shared issue

Intermittent `ERR_SSL_WRONG_VERSION_NUMBER` (Lambda-freeze/stale-connection
flakiness) hits this feature unpredictably, same as referrals — see
`docs/reference/referrals-status.md`'s "Known unrelated issue" section.
Documented, not fixed.
