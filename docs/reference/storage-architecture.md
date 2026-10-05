# Storage architecture — media & document files

> **Status: agreed direction (2026-10-04); slices 1–4 built (storage module, CDN, property wizard + detail page, Drive backfill); Drive backup export not yet.** Replaces the Phase 9a
> "Drive is the source of truth" approach for *new* work. ROADMAP.md still wins
> if it disagrees; this doc should be linked from there when the work is
> scheduled. Origin: the exploration brief in
> [`../task-storage-alternatives.md`](../task-storage-alternatives.md).

## Decision in one paragraph

Store all files in **S3** (`eu-north-1`), tenant-prefixed by `officeId`. Serve
them through **CloudFront** with signed URLs. **Resize photos at upload** and
serve the small copies by default; originals are kept and only fetched on an
explicit download. Uploads go **browser → S3 via presigned PUT**, not through
the Next server action. **Google Drive becomes an optional per-client backup
export**, not the primary store. Existing Drive media is backfilled lazily.

Why now: no second office is committed, but storage has to be solved *before*
agentLedger is offered to anyone else (Levi, 2026-10-05).

## Why (what the numbers said)

- **Storage is not the cost.** S3 bucket `agent-ledger-attachments` holds 33
  objects / 435 KiB (offer PDFs + signatures; `attachments/` is empty). S3
  spend was $0.0004–$0.0035 a month (Jun–Sep 2026). Whole AWS bill ≈ $3.8/mo,
  ~$3.2 of it Amplify. Photos at ~22 GB/yr would cost ~$0.50/mo to store.
- **Access (egress) is the cost lever** — see model below.
- **Drive does not fit in-app viewing or multi-tenancy** (next sections).
- `gi-documents` is DynamoDB rows only — no file storage.

### Access-cost model (illustrative, assumptions not measurements)

30 agents, 25 photos/property, 3 MB originals, 40 detail views/agent/working
day, 22 days ≈ 26,000 detail views/month.

| What is served | Per detail view | Monthly egress | S3 direct | CloudFront | Via Amplify app |
|---|---|---|---|---|---|
| Originals | ~75 MB | ~2 TB | ~$170 | ~$87 | ~$300 |
| Resized gallery (~200 KB each) | ~5 MB | ~130 GB | ~$3 | **$0** | ~$17 |
| List thumbnails (~30 KB each) | ~0.6 MB/page | small | ~0 | $0 | ~0 |

Browser caching reduces all of these further. Two levers matter more than the
provider: **serve resized derivatives**, and **never stream bytes through the
Amplify app** (its bandwidth is the priciest path).

### CloudFront pricing (verified from AWS pay-as-you-go page, Levi's screenshots 2026-10-05)

Region group "Europe, Israel, and Türkiye":

| Item | Price |
|---|---|
| Data out | First 1 TB/month free, next 9 TB $0.085/GB, next 40 TB $0.080 |
| HTTPS requests | First 10 M/month free, then $0.012 per 10,000 |
| Regional data transfer out **to origin** | $0.02/GB (only bytes CloudFront sends *to* the origin, e.g. uploads routed through it — keep uploads direct to S3) |
| Price class | Israel is in the Europe group; Price Class 100 covers it and is cheapest |
| Distribution tenants | First 10 free, 11–200 flat $20/mo, >200 $0.10 each (only needed for per-client custom media domains) |

S3 → CloudFront transfer is free. Levi's account is pay-as-you-go (not the
post-July-2025 Free plan). CloudFront Functions / KeyValueStore are not needed
for v1. (KVS read price not verified.)

## Design

### Data classes

| Class | Examples | Delivery |
|---|---|---|
| Sensitive | offer signatures, offer PDFs, agent invoices/receipts | Short-lived signed URL (existing 10 min S3 presign, or CloudFront signed URL) |
| Property media | photos, forms, documents | CloudFront signed URL, longer-lived is acceptable; served as resized derivative by default |

### Keys

`media/{officeId}/{propertyId}/original/{uuid}-{name}` ·
`…/gallery/{uuid}.webp` · `…/thumb/{uuid}.webp`.
Existing keys (`offers/{officeId}/…`, `attachments/{officeId}/…`) stay as they
are. Tenant isolation = key prefix + app-side `officeId` checks (as today).

### Upload flow

1. Client asks a server action for a presigned PUT (scoped to the agent's
   `officeId`/`propertyId` prefix, short expiry, size/content-type limits).
2. Browser uploads the original directly to S3.
3. A resize step (S3-event Lambda or equivalent) writes `gallery` and `thumb`
   derivatives.
4. The app stores keys (not bytes, not signed URLs) on the `PropertyRecord`.
   Replaces `DriveFileRef` for new uploads.

This also removes the current path where photo bytes pass through the Amplify
server action (`properties/new/(wizard)/media/actions.ts`, 50 MB body limit).
Amplify's real request-size ceiling was **not verified**.

### Read flow

App generates a CloudFront signed URL per image per render; browser loads from
the edge. CloudFront's cache key ignores the signature query params by default,
so different agents share one cached copy. Bucket stays private (Origin Access
Control).

### Auth in prod

S3: Amplify compute role, no secrets (as today). CloudFront signing needs one
key pair (private key in a secret store) — the one new secret; call it out when
building. Plan a `StorageProvider` interface so R2 (zero egress, S3-compatible)
is a config swap if egress ever becomes real money.

## Provisioned resources (2026-10-05, AWS account 204529129418)

| Resource | Id / value |
|---|---|
| CloudFront distribution | `E2WI7CC4XADMLC` → `d3xfa9lhxiv8i.cloudfront.net` (Price Class 100, HTTPS only, HTTP/2+3, `CachingOptimized`) |
| Origin Access Control | `E3MXGK1N5QXD0X` (SigV4) |
| Signing public key / key group | `K1XT7C42GX62LK` / `6bd83027-258a-4f17-92fd-7d21a173bf6b` (all requests require a signed URL) |
| Bucket policy | CloudFront may `s3:GetObject` on **`media/*` only**, for this distribution only — `offers/` and `attachments/` are unreachable via the CDN |
| Bucket CORS | Origins `https://main.d2aqfzo6esnq4n.amplifyapp.com` + `http://localhost:3000`; methods PUT/GET/HEAD. **Add any custom domain here when one exists.** |
| Bucket lifecycle | Abort incomplete multipart uploads after 7 days |
| Env vars (`next.config.ts`, `amplify.yml` wired) | `CLOUDFRONT_MEDIA_DOMAIN`, `CLOUDFRONT_KEY_PAIR_ID`, `CLOUDFRONT_PRIVATE_KEY` — set locally in `.env.local`; **must be added in the Amplify console** (the private key is the one new secret; single line with literal `\n`). Until then `getMediaUrl` falls back to presigned S3 URLs. |

Verified live: signed URL 200, unsigned 403, tampered signature 403, second
request is a cache hit (signature params are not in the cache key),
`/offers/…` through the CDN 403, CORS preflight allowed for the app origin and
refused for another origin. Rotating the key: add a second public key to the
key group, deploy with the new pair, then remove the old one.

## Why not the alternatives

| Option | Verdict |
|---|---|
| Stay as-is (Drive props, S3 rest) | Baseline. Costs ~$0 but fails in-app viewing (no CDN, expiring thumbnail links, proxying costs Amplify bandwidth, API quotas) and multi-tenancy. |
| All on Drive | Same failures; no time-limited links. |
| R2 | Equivalent cost at this scale (~$1/mo saved); adds a vendor and a stored key. Keep as swap-in. |
| Backblaze B2 | Same reasoning as R2. |
| Wasabi | 1 TB minimum (~$7/mo) — poor fit at this size. |
| Cloudinary / imgix | Upload-time resizing covers the benefit more cheaply. Revisit only if on-the-fly transforms become a requirement. |

Prices for R2/B2/Wasabi/Cloudinary are from memory, unverified.

## Drive and multi-tenancy

| Model | Viable? |
|---|---|
| Shared Drive per tenant | No — drives would be owned by our Workspace, count against our storage, client doesn't own data; member management and API limits. |
| Domain-wide delegation per client | No — needs each client's Workspace admin; already failed here (`unauthorized_client`); no equivalent for non-Workspace clients. |
| Per-client OAuth | **Yes, for backup only.** Use the `drive.file` scope (only files the app created). The full `drive` scope is "restricted" and triggers Google's annual third-party security assessment. |

## Optional Drive backup (per-client opt-in)

- Client connects via OAuth (`drive.file`); refresh token stored encrypted per
  tenant.
- Scheduled **one-way** export of originals (and optionally documents) into
  `/agentLedger/{year}/{street} {building}-{apt}/…` in *their* Drive.
- A manifest in DynamoDB records what was copied → idempotent retries.
- Revoked/`invalid_grant`: mark connection "disconnected", stop syncing, notify
  the office admin, never delete anything on the S3 side.
- Their Drive quota is the limit — surface a "backup full" state.
- Effort: ~1–2 weeks plus Google OAuth verification lead time.
- For Levi's office: Drive storage is unlimited, so the backup costs nothing.
  The connector can use the existing Shared Drive + service-account code and
  the same folder layout the office already uses.
- Replaces the old "we back up to Drive anyway" benefit. Whether the existing
  Shared Drive is covered by the office's own backup was **not checked**.

## Migration

1. **New uploads → S3** from the day the new flow ships. No dual-write.
2. **Existing Drive media stays put** (300 properties were imported Sep 2026;
   only 1 has photos recorded in the app — most Drive media predates and sits
   outside the app).
3. **Lazy backfill, per property, on demand** (Levi, 2026-10-05): when an
   old property is opened, the app finds its files in Drive and copies them
   into S3 — see "Existing Drive media" below. No bulk import. Keep
   `DriveFileRef` readable until no records reference it.
4. Drive code (`src/lib/google-drive.ts`) is kept and repurposed as the
   backup connector's service-account flavour for Levi's office.
5. Exit/lock-in: S3-compatible API → R2/B2 move is a copy plus a config
   change. CloudFront is replaceable by R2's built-in CDN.

## Existing Drive media: lazy backfill with ongoing sync

Context: the office's secretary uses the photos in the real Drive folders
(`נכסים בטיפול רימקס חזון` / {year} / property) to upload to all listing sites
today, and **keeps adding photos to Drive**. Goal: eventually the app does the
publishing. S3 is what the app serves; Drive is where old/new files still
arrive until then.

- **Trigger:** a user opens an old property (or its media tab). Nothing runs
  across the whole Drive.
- **Find:** resolve the property's Drive folder (`{year}/{street}
  {building}-{apt}`, same convention as `ensurePropertyFolder`) and store the
  folder id on the `PropertyRecord` (`driveFolderId`). The 300 imported
  properties have none yet.
- **Copy:** list the folder's files; for each one not yet copied, download it
  via the service account and store the original + resized derivatives in S3
  under the normal `media/{officeId}/{propertyId}/…` keys.
- **Sync on each open:** keep a manifest on the property (Drive file id →
  S3 key, plus Drive `md5Checksum`/`modifiedTime`). On every open, list the
  folder again and copy only files that are new or changed, so photos the
  secretary adds to Drive later show up. Drive is never modified or deleted
  from.
- **Deletions in Drive:** decide when built — default is to keep the S3 copy
  and mark it "no longer in Drive".
- **Read access:** the service account must be able to *read* the real folder.
  Writing there failed (zero storage quota; delegation parked), but reading
  needs no quota — sharing the real top folder with the service-account email
  as **Viewer** should be enough, no delegation. **Verified 2026-10-05:** the
  service account sees the real folder (owner ari@remaxjerusalem.com; folder id
  `1YWCp9bnT-rf5v_rcQlEbIsi1X3q2bwZX`) with year folders 2026/2025/2024/2023,
  50+ property folders per year named `{street} {building}-{apt}`, and files
  with `size` + `md5Checksum` (so change detection works). Sample property:
  13 JPEGs of ~250–360 KB each (~4 MB/property — smaller than the 3 MB × 25
  assumed in the cost model). The 2023 folder also has status folders
  (`B נמכר+הושכר`, `C פג תוקף + מבוטל`, …) — decide whether to descend into
  them. Caveats: Drive intermittently returns HTTP 500 on `files.list`
  (`sharedWithMe` + `corpora=allDrives`, and some My Drive listings) — retry with
  backoff and avoid `corpora=allDrives` for My Drive parents.
- **Cost/limits:** the copy is a one-time Drive API read per file, then served
  from CloudFront. Do the copy as a background job (not inside the page
  request) so a large folder doesn't time out; show the Drive-sourced state
  ("syncing") in the UI meanwhile.
- **Future (secretary workflow):** today he publishes by hand to our own
  website plus several third-party listing sites, none with APIs (Levi,
  2026-10-05). Automating that would be browser automation on those sites, not
  official uploads. Not scoped; notes for when it is:
  - Storage need is just "originals reachable server-side": a worker fetches
    them from S3 (presigned GET) and drives each site's upload form. The S3
    design above already supports this.
  - Runs outside Amplify: needs a headless-browser worker (container job on
    ECS/Fargate or similar), per-site scripts, stored site credentials
    (secret store), retries, and a human-visible status/failure queue.
  - Risks: scripts break whenever a site changes its UI; captchas/2FA; site
    terms may forbid automation and can ban the account. Check each site's
    terms and whether it offers a bulk-import / CRM-feed / partner program
    first (not verified for any site).
  - Our own website is the exception: publish to it directly from the app
    (feed or API we control), no scraping.

### Built (slice 4) — how it behaves

`src/lib/storage/drive-sync.ts` + `<DriveSync>` on `/properties/[id]`:
- **Trigger:** opening a property whose last sync is older than 10 min (or never),
  plus a "Refresh from Drive" button. Batches of 6 files per call so a big
  folder can't time out; the client loops until done and then refreshes.
- **Match:** an in-memory index of every property folder under the real root
  (years newest-first, 2023-style `B נמכר…` status folders skipped), names
  normalised (Hebrew quote variants, spaces). Candidates: `{street} {bldg}-{apt}`;
  with no apartment: `{street} {bldg}-0`, then `{street} {bldg}`. All four years
  are searched; newest year wins. No match → `driveMatch: "not_found"`.
- **Copy:** new or changed files only (Drive `md5Checksum`); originals +
  resized copies; Google Docs/Sheets skipped (no bytes). Images land in
  `additionalPhotos` (Drive has no "main photo"), everything else in
  `documents`. Files > 40 MB skipped. A per-property Redis lock stops two tabs
  syncing at once.
- **Drive is never modified.** A file later removed from Drive keeps our copy,
  flagged `driveMissing` (not yet shown in the UI). A *changed* file replaces
  its ref; the old objects are orphaned in the bucket (no delete yet).
- **Loop guard for slice 5:** files carrying the Drive `appProperties` key
  `agentledgerKey` are ignored by the sync — the backup export must set it on
  every file it writes, or the sync would re-import our own backup copies.
- **Tested live** (2026-10-05) on `דניאל 5-1`: 13 files (11 photos + 2 PDFs)
  copied in 3 batches, second sync copied 0, unknown address → no match, other
  office rejected, photos render from CloudFront in the browser. First batch is
  slow (~20 s) because it builds the folder index.

## Cheap wins (independent of the migration)

- S3 lifecycle rule: abort incomplete multipart uploads after 7 days (bucket
  currently has no lifecycle config; versioning is off; SSE-S3 is on).
- Drive WIF to drop the static key — only worth doing if Drive stays on the
  critical path (it won't, post-migration).
- Do **not** finish domain-wide delegation; the backup connector supersedes it.

## Failure modes to design for

- CloudFront signing key rotation/loss → all photo links break; plan rotation.
- Resize step fails or lags → UI must fall back to the original (or a
  placeholder) until derivatives exist.
- Presigned PUT abuse → enforce size/type limits and expiry, scope to prefix.
- Backup OAuth revocation → see Drive backup above.

## Open questions for Levi

Answered (2026-10-05): the secretary uses the Drive photos to publish to all
sites today, and wants the app to take that over eventually; existing Drive
media should load on request, not be bulk-imported. Workspace Drive is
unlimited. No second office is committed, but storage must be solved before
offering.

1. Deleted-in-Drive behaviour (default: keep S3 copy, mark it)?
2. Will the real Drive folder be shared with the service account as Viewer?
3. Is the Shared Drive covered by the office's backup?
4. Which listing sites exactly, and does each offer a bulk-import / feed /
   partner option? (Known: no APIs; manual today.)
5. Actual photo volume (photos/property, MB/photo) and expected agent count —
   the cost model above uses assumptions.

## Not covered

No code written. Amplify request-size limit, KVS pricing and
R2/B2/Wasabi/Cloudinary prices were not verified. The Drive-side numbers
(usage, plan) were not obtainable from this environment; Levi states the
Workspace Drive storage is unlimited.
