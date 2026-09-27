---
name: offers-status
description: "Purchase-offer feature (Phase 9) — known gaps, dormant infrastructure, and planned-but-undecided work."
metadata:
  type: project
  modified: 2026-09-27
---

Companion to the `offers` bullet in ROADMAP.md's Phase 9 section — that
covers what the feature is; this tracks what's still open.

## Known gaps

- **RE/MAX logo not sourced.** `public/remax-logo.png` genuinely doesn't
  exist — "with logo" silently falls back to no logo in both the PDF
  (`src/lib/offers/pdf/render.tsx`) and the buyer thank-you page
  (`src/app/offer/[token]/page.tsx`). Needed: a transparent-background PNG,
  at least 800×400px (1200×600 preferred), matching the actual RE/MAX
  Vision lockup's aspect ratio (~2:1) — both call sites auto-scale to fit
  (140pt wide in the PDF, 64px tall on the web page), so the source file's
  exact size isn't critical as long as it's high-res enough not to look
  soft when scaled down.
- **`DYNAMODB_TABLE_OFFERS` isn't set in Amplify's env vars for `main`** —
  would break immediately if this branch deployed today. See also
  `NEXT_PUBLIC_APP_URL`, also unset there (affects the buyer link/email —
  `APP_BASE_URL`'s fallback in `src/lib/office.ts` points at a different
  app's domain).

## Dormant infrastructure (present, not called anywhere)

- **`src/lib/short-io.ts`** — `shortenUrl()` for Short.io's link API. Levi
  wants the offer buyer links shortened eventually (the raw
  `/offer/[token]` URL "looks wild") but hasn't decided the exact
  domain/scope. Env vars (`SHORT_IO_API_KEY`/`SHORT_IO_DOMAIN`) are already
  in `.env.example` and `next.config.ts`'s bake-into-bundle whitelist, so
  wiring it in later is just a call site + a decision, not a setup task.

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
  transition itself until that's answered.

