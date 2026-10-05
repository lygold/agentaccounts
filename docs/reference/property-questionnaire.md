# Property questionnaire ↔ Monday board

> Status: built and tested live 2026-10-05 (local; **not yet deployed** — see ROADMAP).
> Source of truth for the questions: the original Superform
> (`superform.spot-nik.com/form/66f3eedf7560d752eaab3ac0`). Source of truth for
> the option lists: the Monday "Properties Raw Data" board's dropdown/status
> columns (the form's options are the same labels).

## Rules

**Options = Monday's labels.** `src/lib/property-wizard/options.ts` holds the
lists; the stored value *is* the Monday label, so what an agent picks is exactly
what the Monday push writes. Legacy duplicates/truncated labels that exist on the
board (`"3 - במצב שמור (במצב טוב"`, `"חלקי:בחלק מהדירה"`, …) are not offered.
Yes/no checkboxes became the real dropdowns: elevator (כן/לא/מעלית שבת),
balcony (8 types), a/c (6), parking (4), condition (5), extra features
(multi-select of 23).

**Mandatory questions** (`src/lib/property-wizard/required.ts`, from the form's
`*` markers): deal type, contract type; city, neighbourhood, street, building,
apartment; commission %, VAT; property type; "did the client come from a
referral"; owner name/phone/email; main photo, additional photos, forms,
copyright yes/no, renderings yes/no; Hebrew title, "two descriptions" yes/no,
Hebrew description; rooms, bedrooms, toilets, master suite, floor, floors total,
size, **asking price**, condition, elevator, balcony, a/c, parking, storage,
safe room; all seven internal ratings. Optional: bathrooms, levels, plot size,
garden, extra features, entrance, publish-notes, English title/description, Yad2
package, virtual tour, YouTube, documents, balcony/garden/parking/storage sizes.
Each step saves what was typed but won't advance (server-side) until its
mandatory answers are in, and names what is missing; the review step lists
everything still missing and blocks "Save".

**Conditional questions** (checked against the live form): referral = "לא" →
required "where did the client come from" (dropdown596); referral = external
agent → agent name/office/phone; either referral type → referral %; "two
descriptions = כן" → Yad2 description required. Choosing a balcony type does
**not** reveal a size question in the original form (the size inputs here are
optional extras that map to Monday's size columns).

**Price.** Agents are asked only `מחיר מבוקש` (asking price). `startingPrice`
(מחיר התחלה) is set from it once, at creation, and is never editable; the edit
form shows it read-only and only moves `askingPrice`. Older properties get it on
their first price change (their previous asking price).

## Monday push (`src/lib/sync/property-columns.ts`, `properties.ts`)

67 columns written, each in its column type's format (status `{label}`,
dropdown `{labels:[…]}`, long text `{text}`, date `{date}`, relation
`{item_ids}`, numbers as numbers). All ids verified against the live board.
Not written: the file columns (photos/forms live in storage + Drive), Potential
Com., End Date of Yad2, the second referral-% / referral-agent relation.
Non-numeric building/apartment numbers ("12א") can't go into a numbers column and
are reported, not silently dropped. Properties from the first wizard version
(old option keys, true/false) are translated on the way out
(`property-wizard/legacy.ts`).

**Why it was failing (fixed):** the VAT column (`dropdown09__1`) is a dropdown but
was sent `{label}` (status format) → Monday rejected the whole item → nothing was
created, and the failure was caught and only dead-lettered to Redis where nothing
ever showed it. Every wizard-created property was affected.

**Failure behaviour.** If Monday rejects the full set, the item is still created
with core fields and flagged *partial*. The error is stored on the property
(`mondaySyncError`), kept in the dead-letter history, and raised as an
**admin-only** alert.

## Admin-only alerts

Agents never see Monday. For admins: a red count badge on the **Monday sync**
nav link and `/admin/monday-sync` (failed or never-pushed properties, last error,
Retry / Retry all). An email goes to every admin (admin-role agents with an email
+ `BOOTSTRAP_ADMIN_EMAIL`), once per distinct failure, **only if
`MAKE_NOTIFICATION_WEBHOOK_URL` is set** — it is *not* set in Amplify today, so
until that Make scenario exists alerts show in-app only. WhatsApp isn't used
(business-initiated WhatsApp needs a pre-approved template; there is none for
system alerts). The Drive-sync controls are also admin-only (the sync itself still
runs for everyone).

## Known gaps / assumptions

- Edits made after creation (edit form) are **not** pushed to Monday; only
  creation and admin Retry push. (Monday is being retired.)
- Rating labels: 0 → the caption label, 1–10 → the bare number; the board's
  `"9 - …"` caption labels are never written.
- `הפניה סוכן משרד` (office agent) asks only the referral %; the board's
  agent-relation column for it isn't populated.
- The inbound Monday → app sync still reads only its original 13 fields and can
  overwrite `askingPrice` from Monday.
- A property whose agent has no Monday item (e.g. the break-glass admin) gets no
  Agent relation on the Monday item.
