# Monday.com AI-assisted property auto-fill

## Context

Filling in a listing manually (address, price, description, photo) is slow, and agents'
real listing data already lives in Monday.com. Levi wants an option, when claiming a
box, to identify themselves by name and pick from their own active Monday listings
instead of typing everything by hand — with an AI step turning the raw Monday record
into ad copy, using a system prompt he's already written and tuned against hundreds of
real published ads. The open problem he flagged himself: several agents share a first
name (real data confirms this — three different agents named Shira, several named
David), so the flow has to disambiguate without being confusing, and without leaking
one agent's business data to someone who merely types their name.

This plan is grounded in live queries against Levi's actual Monday.com account (not
assumed structure), his actual prepared prompt (`system_prompt.md`, repo root), and a
real reference implementation he shared from another of his projects ("sikkumPigisha")
— 5 TypeScript files (`monday-client.ts`, `types.ts`, `columns.ts`, `properties.ts`,
`agents.ts`) that already solve Monday GraphQL querying, pagination past Monday's
200-item page cap, and the board-relation ownership-check pattern. The data-layer
design below is a direct adaptation of that code (ported to this repo's plain
CommonJS JS style — no TypeScript, no Next.js `"server-only"`, which isn't relevant
here since this is already server-side Express code), not a rebuild from scratch. The
picker/lookup UI (React components) wasn't part of what was shared — that part of this
plan is still an original design.

## Real Monday.com structure (verified live, not assumed)

**Board 1 — agent identity: "Daf Kesher" (id `1593085910`)**, 29 current items, top
group literally named "Active". Relevant columns: `name__1`/`surname__1` (Hebrew first
name / surname), `text_mm01ab4y` "English" (English full name — already stores both
scripts, exactly matching the "type in Hebrew or English" requirement), `phone__1`,
`status__1` (Active / Onboarding / Inactive / Offboarding — filter to the first two).
Confirmed real collisions: 3 agents first-named Shira (distinct surnames), multiple
named David.

**Board 2 — listings: "Properties Raw Data" (id `1633691694`)**, 304 items. Relevant
columns:
- `connect_boards__1` "Agent" — board-relation to board 1, returned as
  `[{id, name, board:{...}}]` — this `id` is the board-1 item id, directly comparable
  to whatever agent was phone-verified.
- `status_1_mkn4k7fk` "Listing Status" — filter to `Active` when listing pickable
  properties.
- `text56__1`/`text57__1`/`text37__1`/`numeric__1`/`numeric2__1` — city / neighborhood /
  street / house number / apartment number.
- `dropdown01__1` "הערות לפרסם" — **address privacy level**, values seen in real data:
  null (full address OK), `"שם הרחוב בלי מספר"` (street name, no house number),
  `"רק שכונה"` (neighborhood only). **Confirmed this is actively used and must be
  respected** — a live listing (Alyssa Friedland's Bar Kochba St property) has this set
  to street-without-number, and the real published ad for that exact listing (seen
  earlier this session, in the reference PDF) indeed omits the house number. Getting
  this wrong would leak an address detail a seller asked to keep off the ad.
- `long_text1__1` "כותרת: תיאור הנכס בקצרה באנגלית" — an English short title, already
  populated on many listings and close in style to final ad copy. Feed this in as the
  prompt's `notes` field (rich free-text context), not as a bypass of the AI step.
- `numeric7__1` "מחיר מבוקש" (asking price) — use this over `numeric5__1` "מחיר התחלה"
  (original starting price); asking price reflects the current ask.
- `numeric6__1`/`numeric142__1` (rooms/bedrooms), plus bathroom/floor/feature dropdowns
  (elevator incl. "Shabbat elevator", parking, mamad, garden, storage, balcony type
  incl. "sukkah balcony", condition/renovation, "יחidת הורים") — map into the prompt's
  `features[]` array.
- `files__1` "תמונה ראשית" (main photo) and `dup__of_files9__1` "תמונת נוספות"
  (additional photos) — both hosted under `/protected_static/...`, meaning they need an
  authenticated (token-bearing) server-side fetch, not a public hotlink. See Photo
  handling below — main photo is the default, agent can switch to an additional photo
  or upload their own.
- Fields that exist on this board but must **never** reach the frontend: seller name /
  phone / email, commission percentages, CMA valuation fields, internal quality/
  motivation ratings.

**The prompt (`system_prompt.md`)**: generates the **description only** — not address,
not price. Input: `{listing_type, rooms, bedrooms, bathrooms, size_sqm, floor,
neighborhood, features[], notes}`. Output: plain description text, 14–22 words
(target 17), never mentions price/currency, never Hebrew. Recommended model: Claude
Sonnet, prompt sent via the `system` parameter (static, cacheable). Its own author's
notes recommend a word-count check with one retry, and sanitizing `notes` free text
before it reaches the API (the model is already told to ignore instruction-like content
in `notes`, but stripping upstream is a cheap second layer) — both worth implementing,
not just noted. Address and price are **not** AI-generated — deterministic field
mapping + the privacy-level formatting logic above.

## Decisions confirmed with Levi

- **Security/disambiguation**: match on full name. If the typed name matches multiple
  agents, show a plain list of full names (no phone numbers shown at that stage) to
  pick from. **Phone confirmation is required for every agent, even a unique match** —
  not just the collision case. Never pull or expose sensitive fields (seller contact
  info, commission %, etc.) — the backend must not even fetch those columns for this
  feature, let alone send them to the browser.
- **AI provider**: Claude API (Sonnet), `ANTHROPIC_API_KEY` needs setting up (not yet
  configured for this repo — Levi to provide/set the key, following the existing
  `S3_UPLOADS_BUCKET`/`ADMIN_PASSWORD` env var pattern: exported locally, Amplify
  secret in prod).
- **Monday API token**: not yet provisioned for server-side use (separate from this
  session's own MCP connection) — Levi will generate one from Monday's Admin → API
  section. New `MONDAY_API_TOKEN` env var, same pattern as above.
- **Reference implementation**: shared (see above) — the data-layer design below ports
  it directly rather than reinventing Monday's pagination/filtering quirks.
- **Branch sequencing**: `feature/i18n` (which now also carries the border/sizing/
  preview-step work from this same session) should be merged to `main` first — this
  new feature will touch the box-click entry point and `AgentForm.jsx` again, and
  merging first avoids the same kind of double-edit problem solved earlier this session
  by merging `feature/price-field` before starting `feature/i18n`. Branch this feature
  off the updated `main` as `feature/monday-autofill`.

## Architecture

### Entry point change

Clicking an empty box currently opens `AgentForm` directly (`PublicPage.jsx` →
`setSelectedBox`). Insert a small chooser first: **"Pull from my Monday listings"** vs
**"Enter manually"**. Manual keeps today's exact `AgentForm` flow, untouched. The
Monday path runs a new multi-step flow, then hands its result into the *same*
`AgentForm` (added `initialData` prop, seeds `formData` instead of empty strings) so
the agent still reviews/edits and goes through the existing Preview → Confirm & Submit
steps built earlier this session — this reuses that flow rather than creating a second
submission path.

### New frontend: `frontend/src/components/MondayPickerFlow.jsx`

Steps, each a friendly, single-focus screen (translated via the existing `useI18n()`):
1. **Name** — one text input, Hebrew or English, matches against board 1.
2. **Candidates** — even for a single match, show it as a card ("Is this you? [Full
   Name]"); for multiple matches, a plain list of full names. No phone/email shown
   here. Selecting one proceeds to:
3. **Phone confirmation** — one input, compared server-side (normalized: strip
   spaces/dashes/leading zero-country-code variants) against the selected candidate's
   `phone__1`. Wrong number → friendly retry, with a manual-fallback button always
   visible (never a dead end).
4. **Listings** — cards showing address summary (privacy-level-aware) + price + (if
   available) thumbnail, for that agent's `Active` listings only.
5. **Auto-filling…** loading state, then hands `{address, price, description}` to
   `AgentForm` as `initialData` and closes the picker flow.

Zero matches at step 1, or zero active listings at step 4, both get a friendly message
plus the manual-fallback button — never a dead end.

### New backend: `backend/lib/monday/` (ported from the sikkumPigisha reference)

Four small CommonJS modules, adapted from the reference's TS files (same logic, this
repo's style — `require`/`module.exports`, no types, no `"server-only"`):

- **`client.js`** (from `monday-client.ts`) — the `mondayQuery(query, variables)`
  fetch wrapper: POSTs to `https://api.monday.com/v2` with the token in the
  `Authorization` header and an `API-Version` header, and — important detail the
  reference gets right — **checks `body.errors`/`body.error_message` even on a 200
  response**, since Monday returns HTTP 200 for GraphQL-level errors. Throws at
  call-time (not require-time, matching the reference) if `MONDAY_API_TOKEN` is unset.
  Custom `MondayApiError`/`MondayConfigError` classes, worth keeping as-is.
- **`columns.js`** (from `columns.ts`) — the column ID map. IDs already verified live
  this session (see Board 1/2 structure above) and match the reference's
  `AGENTS_BOARD`/`PROPERTIES_BOARD` almost exactly — good cross-confirmation. **One
  deliberate omission**: the reference's `PROPERTIES_BOARD.ownerSide` (seller
  name/phone/email columns) is **not ported** — this feature has no legitimate reason
  to fetch seller contact info at all, so leave those column IDs out of this repo's
  version entirely rather than fetching-then-discarding them.
- **`agents.js`** (adapted from `agents.ts`) — port `listAgents(boardId,
  excludeAgentId?)` and `getAgentById(boardId, id)` as-is, including their pagination
  handling (`items_page` → `next_items_page` with a `cursor`, looping until
  `cursor` is null — **required**, not optional, since board 2 alone has 304 items,
  past Monday's 200-item page cap; a naive single-page fetch would silently drop
  results). Also port `normalizePhone()` (strips spaces/dashes/parens, normalizes
  `+972`/`972` prefixes to a leading `0`) — used for the phone-confirmation compare.
  **Do not port `findAgentByContact`** — it backs the reference's phone/email-based
  OTP login with a deliberate anti-enumeration refusal on ambiguous matches; this
  feature's identity flow is name-first with an explicit disambiguation list, a
  different security shape by design (Levi confirmed: show the list, don't silently
  refuse). Add a new `findAgentsByName(agents, name)` — a plain filter over
  `listAgents()`'s already-paginated result, matching against `name`/
  `firstNameHebrew`/`fullNameEnglish` case-insensitively, restricted to Active/
  Onboarding `status__1` (the reference's `listAgents` doesn't filter status since
  sikkumPigisha didn't need to — add that filter here).
- **`properties.js`** (adapted from `properties.ts`) — port `listPropertiesForAgent`
  and `getPropertyForAgent`, **including the technique that makes agent-ownership
  filtering actually work**: Monday's `items_page_by_column_values` can filter by
  status columns server-side, but **cannot filter by a board-relation column
  server-side** — the reference fetches everything matching the status filter (with
  the same page/cursor pagination as agents), requests the `connect_boards__1` column
  aliased as `agent_relation` with a `... on BoardRelationValue { linked_items { id } }`
  fragment, and filters by `linked_items` containing the target agent id *after*
  fetching. `getPropertyForAgent` calls the same ownership check and throws
  `MondayOwnershipError` if the requested property doesn't belong to the given agent —
  this is the exact server-side re-check this plan's `/api/monday/listings` and
  `/api/monday/autofill` endpoints rely on. **Strip the `owner`/`ownerSide` fields from
  `PropertyDetails` and from `DETAIL_COLUMNS`/`toDetails()`** — same reasoning as
  `columns.js` above; this repo's version returns only the ad-relevant subset (street,
  building/apt number, neighbourhood, rooms, sizeSqm, price, dealType).

`backend/lib/monday/photo.js` (new, no reference equivalent — the shared code didn't
cover file columns) fetches `files__1`/`dup__of_files9__1` via an authenticated request
using the same `client.js`, for the photo-picker endpoint below.

### New backend: `backend/lib/aiCopywriter.js`

Wraps the Claude API call. **Embed the system prompt text as a JS string constant in
this file — do not read `system_prompt.md` at runtime.** This repo already hit exactly
this bug once (`backend/utils/pdfGenerator.js`'s fonts/templates/`layout.json` had to
move to S3 because Amplify Gen2's esbuild bundling only bundles `.js` files, not
arbitrary files on disk) — a `.md` file read via `fs.readFileSync` would silently
`ENOENT` in that deployment the same way. Also implements: the word-count check +
one retry from the prompt author's own notes, and a light sanitization pass stripping
instruction-like content from the `notes` input before it's sent (the `long_text1__1`
short title text) — belt-and-suspenders alongside the prompt's own instruction to
ignore such content.

### New backend: `backend/routes/monday.js`

Wired into `app.js` alongside the existing `submissions`/`admin` routers. All
listing/autofill calls are **stateless and re-verify on every request** (no session
infra exists in this app, so don't invent one) — each call re-sends `agentId` +
`phone`, and the server re-checks the phone match every time rather than trusting a
client-held "verified" flag:

- `POST /api/monday/find-agent` `{name}` → `agents.listAgents()` + the new
  `findAgentsByName()` filter → `[{agentId, nameHebrew, nameEnglish}]` (no phone/email
  in the response — `Agent.phone`/`.email` from the ported type are stripped before
  sending)
- `POST /api/monday/verify-phone` `{agentId, phone}` → `agents.getAgentById()`, compare
  `normalizePhone(phone) === agent.phone` → `{verified: boolean}`
- `POST /api/monday/listings` `{agentId, phone}` → re-verify via the same compare, then
  `properties.listPropertiesForAgent()` mapped to safe-subset cards (id, address
  summary, price, thumbnail if available) — never the owner/commission/internal fields
  (already absent, since `columns.js`/`properties.js` don't fetch them at all)
- `POST /api/monday/autofill` `{agentId, phone, propertyId}` → re-verify phone, then
  `properties.getPropertyForAgent()` (throws `MondayOwnershipError` if `propertyId`
  isn't this agent's — let that 403), map fields, call `aiCopywriter`, return
  `{address, price, description}`
- `GET /api/monday/photo` `{agentId, phone, propertyId, fileIndex}` → re-verify phone
  and ownership (via `properties.getPropertyForAgent`, same as autofill), then
  `photo.js` authenticates against Monday with `MONDAY_API_TOKEN` and streams the image
  bytes back (main photo is `fileIndex` 0 / default; additional photos indexed after)

### Field mapping (deterministic, in `backend/routes/monday.js` or a small helper)

- `address`: `text37__1` + `numeric__1` (street + house number) if `dropdown01__1` is
  null; street only if `"שם הרחוב בלי מספר"`; `text57__1` (neighborhood) only if
  `"רק שכונה"`.
- `price`: `numeric7__1`, formatted the same way `AgentForm.jsx`'s structured price
  input already formats a value (`NIS ${Number(x).toLocaleString('en-US')}`) — reuse
  that formatting logic rather than duplicating it.
- AI prompt input JSON: `listing_type` from `color__1` (label strings verified directly
  against this board's own status settings this session — `"מכירה"` → sale, `"השכרה"`
  → rent; use these over the reference's `STATUS_LABELS.dealType` comment, which reads
  as if reversed, likely an RTL-paste artifact), `rooms`/`bedrooms` from
  `numeric6__1`/`numeric142__1`, `size_sqm` from `numeric14__1`, `floor` from
  `numeric9__1`, `neighborhood` from `text57__1` (context only, per the prompt's own
  instruction not to restate it as a label), `features[]` derived from the
  elevator/parking/mamad/garden/storage/balcony/condition dropdown columns (translate
  Hebrew labels to the prompt's expected English feature phrasing), `notes` from
  `long_text1__1`. The reference's `PROPERTIES_BOARD.property`/`DETAIL_COLUMNS` only
  covers `rooms`/`sizeSqm`/`price` (sikkumPigisha didn't need the rest) — extend
  `columns.js`'s property section with `bedrooms`, `floor`, and the feature-dropdown
  IDs so `properties.js`'s `DETAIL_COLUMNS`/`toDetails()` carries what this prompt
  actually needs.

### Photo handling

Default to Monday's main photo (`files__1`, "תמונה ראשית"), but let the agent change it
— either pick a different photo already on the listing (`dup__of_files9__1`,
"תמונת נוספות" / additional photos), or upload their own instead of anything from
Monday. Whichever source is chosen still goes through the **existing, unchanged**
`ImageCropper` step (`aspect={1.55}`) — a Monday-sourced image is just a different way
to arrive at the `rawFile` that component already expects, not a new code path through
crop/resize/upload.

Monday's photo URLs are behind `/protected_static/...` — the frontend can't hotlink
them directly (no token). Add `GET /api/monday/photo` (query: `propertyId`, `fileIndex`
or similar, plus `agentId`+`phone` for the same re-verification-on-every-call
principle as the other endpoints) that authenticates the fetch server-side with
`MONDAY_API_TOKEN` and streams the image bytes back — `lambda.js` already sets
`binary: ['image/*', ...]` for `serverless-http`, so this doesn't need new binary-
response plumbing, just a route using it. In the **Listings** step (step 4) or right
after picking a property, show the main photo pre-selected plus thumbnails of any
additional photos and an "Upload my own instead" option; the chosen image (fetched via
this endpoint, or a locally picked file) feeds into `ImageCropper` exactly like today.

## New env vars

- `MONDAY_API_TOKEN` — Monday.com API token, server-side only.
- `ANTHROPIC_API_KEY` — Claude API key for the description-generation step.

Both follow the existing pattern: exported in the shell for local dev, added to
`.env.example`, and set as an Amplify secret for `main` per DEPLOY.md §6's existing
`ADMIN_PASSWORD` precedent.

## i18n

All new `MondayPickerFlow` strings need `en`/`he` entries in
`frontend/src/i18n/translations/`, following the existing `t()` pattern — this feature
is public-page-only, same scope boundary as the language switcher itself.

## Implementation sequence

1. Merge `feature/i18n` to `main`, push; branch `feature/monday-autofill` off updated
   `main`.
2. Get `MONDAY_API_TOKEN` and `ANTHROPIC_API_KEY` from Levi; add to local env and note
   in `.env.example`.
3. `backend/lib/monday/` — port `client.js`/`columns.js`/`agents.js`/`properties.js`
   from the sikkumPigisha reference (adapt TS→CommonJS, strip owner/ownerSide fields,
   add `findAgentsByName`, extend property columns per Field mapping above), plus new
   `photo.js`. Test each function directly (a small script or curl against a temporary
   debug route) against the real boards before wiring up UI — the reference's
   pagination and agent-relation-filtering logic is easy to get subtly wrong when
   porting, so confirm against real data (e.g. board 2's 304 items, past the 200-item
   page cap) before trusting it.
4. `backend/lib/aiCopywriter.js` — embedded prompt constant, Claude API call, word-count
   retry, notes sanitization. Test against a couple of real property records (e.g. the
   Bar Kochba and Nikanor listings already inspected this session) and compare output
   style against the real published ad copy for those same listings.
5. `backend/routes/monday.js` + wire into `app.js`.
6. `frontend/src/components/MondayPickerFlow.jsx` + the entry-point chooser in
   `PublicPage.jsx`/`BoxGrid` click handling + `initialData` prop on `AgentForm.jsx`.
   Include the photo picker (main photo default, additional-photo thumbnails, upload-
   your-own option) feeding into the existing `ImageCropper`.
7. i18n strings for the new flow.
8. End-to-end test with a real agent (see Verification).

## Verification

1. Unit-level: call each `lib/monday/` function directly against the real Monday
   boards for a known agent (e.g. David Weiser / Alyssa Friedland, already confirmed to
   have active listings) and confirm shapes match this plan's field mapping.
2. Confirm the Bar Kochba St listing's auto-filled address omits the house number
   (privacy-level regression check using a listing already confirmed to need it).
3. Full flow in the browser: empty box → Monday path → type a first name known to
   collide (e.g. "שירה"/"Shira") → confirm the candidate list shows distinct full
   names → pick one → enter a deliberately wrong phone (expect friendly rejection) →
   enter the correct phone → confirm listings appear → pick one → confirm
   address/price/description prefill into `AgentForm` → edit if desired → Preview →
   Confirm & submit, exactly like the manual flow.
4. Confirm manual fallback works at every dead-end point (no match, wrong phone after
   retries, zero listings).
5. Confirm the browser network tab never shows seller contact info, commission %, or
   any board-1/board-2 field beyond what's in the safe-subset response shapes above.
6. Confirm `/api/monday/listings`, `/api/monday/autofill`, and `/api/monday/photo`
   each reject a request with a correct `agentId`+`phone` but a `propertyId` belonging
   to a *different* agent (the ownership re-check).
7. Confirm the photo picker defaults to the main photo, that switching to an
   additional photo or uploading a manual file both still flow correctly through the
   existing `ImageCropper` crop step unchanged.

## Critical files

- `frontend/src/pages/PublicPage.jsx` (entry point / chooser wiring)
- `frontend/src/components/AgentForm.jsx` (`initialData` prop)
- `frontend/src/components/MondayPickerFlow.jsx` (new)
- `backend/lib/monday/client.js`, `columns.js`, `agents.js`, `properties.js`, `photo.js`
  (new — first four ported from the shared sikkumPigisha reference)
- `backend/lib/aiCopywriter.js` (new)
- `backend/routes/monday.js` (new)
- `backend/app.js` (wire new router)
- `system_prompt.md` (source of truth for the embedded prompt constant — keep them in
  sync if Levi edits the prompt later)
