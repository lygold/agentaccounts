# Task: Explore file/blob storage alternatives to Google Drive and S3

**Type:** exploration / tradeoff write-up. NOT a decided migration — present options and a recommendation, do not implement a switch.

## Why this is being looked at

Two reasons property photos/documents went to Google Drive (ROADMAP Phase 9a, Decisions Log "Doc storage" row):

1. **Cost** — file storage is the real cost lever (DynamoDB is cheap on PAY_PER_REQUEST regardless of volume).
2. **Convenience** — the office already uses Google Drive and backs its data up there.

Any alternative has to be judged against both: it must be cheaper (or no worse) *and* not lose the "it's already in our Drive / already backed up" convenience, or else supply an equivalent.

## Product direction: multi-tenancy and Drive as an optional backup

agentLedger is multi-tenant (offices/clients), so storage has to be judged for that, not just for this office:

- **Drive is not the simplest fit for multi-tenancy.** Today's setup is one service account writing into one Shared Drive for one office. Per-client isolation would need either a Shared Drive/folder per tenant (provisioning, membership, quota and API-limit overhead) or each client granting access to *their own* Drive via OAuth (per-tenant refresh tokens to store, rotate and handle revocation) or domain-wide delegation (per-client Workspace admin setup — the very thing that failed with `unauthorized_client` here). Non-Workspace clients have no equivalent at all.
- **Product requirement to keep:** clients should still be able to opt in to **backing up their data to their own Google Drive**. Treat this as an optional export/sync feature, not the primary store. That implies a primary store that is tenant-isolated by design (e.g. per-tenant key prefixes, as S3 already does with `officeId`) plus a Drive backup connector.

## Current state (read the code, don't trust this summary)

- **Google Drive** — property photos/documents. `src/lib/google-drive.ts`. App stores only `{driveFileId, webViewLink}`, never bytes. Writes go to a dedicated **Shared Drive** via a service account with a static private key in env (`GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`). Domain-wide delegation (to write into the real `נכסים בטיפול רימקס חזון` folder) failed with `unauthorized_client` and was parked. WIF (AWS role → GCP token, no static key) is a parked hardening follow-up. See ROADMAP §9a and §6.
- **S3** — bucket `agent-ledger-attachments` (eu-north-1). `src/lib/s3-attachments.ts`, `src/lib/offers/storage.ts`. Offer PDFs + signature PNGs, agent invoice/receipt attachments. Private bucket, presigned URLs (10 min), IAM via the Amplify compute role in prod (no secrets), static keys for local dev only. Roadmap calls this low-volume and explicitly not migrated.
- Green Invoice documents (`gi-documents` store) appear to be DynamoDB rows only, no file storage — confirm.
- Hosting: AWS Amplify.

## Constraints any alternative must meet

- **Auth story in production:** S3 gets IAM-role access with no secrets. Drive currently uses a static service-account key. An alternative that needs a stored secret is trading "no secrets" for "a secret to manage and rotate" — call this out per option.
- **Time-limited access:** presigned-URL-equivalent (no public exposure, fresh per request) for sensitive docs (signatures, invoices). Property photos may have looser needs — distinguish the two data classes.
- **Real data exists:** production PDFs/signatures/attachments in S3 and real property media in Drive. Each option needs a migration story, not a greenfield design.
- **Multi-tenant isolation:** per-tenant separation of data and access, with an onboarding path that doesn't need manual per-client admin-console work.
- **Optional Drive backup:** the design must leave room for a per-client opt-in backup to their own Drive (auth model, what gets copied, one-way vs. sync, what happens on revoked access).
- **Office workflow:** staff browse/share property media in Drive today and it doubles as backup. Note what each option does to that.

## Questions to answer

1. **Actual cost today.** Pull real numbers: S3 bucket size + request/egress spend (Cost Explorer), Drive storage used vs. Workspace plan quota/pooled storage, and what growth looks like (photos per property × properties per year). Without this, "cheaper" is a guess. S3 side is likely cents/month — verify.
2. **Where does storage cost actually bite?** Property photos are the large files. Is Drive effectively free (included in the Workspace plan) so the real cost is engineering friction (delegation, key management), not dollars?
3. **Options to compare** (at minimum): stay as-is (Drive for properties, S3 for the rest); consolidate everything on Drive; consolidate everything on S3 (+ lifecycle rules, Intelligent-Tiering/IA/Glacier); S3-compatible low-cost providers (Cloudflare R2 — no egress fees, Backblaze B2, Wasabi); other (e.g. Cloudinary/imgix-style image services if photo delivery/resizing matters). Add any others that fit.
4. **Per option:** monthly cost at current and 3× volume; prod auth model (secrets?); presigned-URL equivalent; migration effort for existing data; effect on the office's Drive-as-backup workflow (and what a backup would look like instead); lock-in/exit cost; failure modes.
5. **Cheap wins that need no migration:** S3 lifecycle rules, Drive WIF to drop the static key, finishing the parked delegation vs. keeping the Shared Drive.
6. **Multi-tenancy per option:** how each handles tenant isolation, per-tenant cost attribution, and onboarding. For Drive specifically, compare Shared-Drive-per-tenant vs. per-client OAuth vs. delegation, and say which (if any) is viable.
7. **Drive backup feature:** how a per-client opt-in backup would work (OAuth to the client's own Drive, scheduled one-way export, folder layout, handling revoked tokens, quota on their side). Rough effort, and whether it changes which primary store is best.
8. **Backup angle:** if media leaves Drive, how does the "we back up to Drive anyway" benefit get replaced (scheduled sync/export)? If media stays in Drive, is the Shared Drive itself covered by the office's backup?

## Deliverable

A short comparison (table + recommendation) covering the options above, with real cost numbers where obtainable, the migration path for the recommended option, and an explicit "do nothing" baseline. End with a recommendation and what decision is needed from Levi. No code changes.
