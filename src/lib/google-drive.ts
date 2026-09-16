import "server-only";
import { randomUUID } from "node:crypto";
import { SignJWT, importPKCS8 } from "jose";
import type { DriveFileRef } from "./types";

/**
 * Phase 9 — Google Drive as the storage source of truth for property
 * photos/documents (agentLedger never stores the bytes, see DriveFileRef
 * in types.ts). No `googleapis` dependency — same low-dependency style as
 * src/lib/monday/client.ts: a service-account JWT (signed with `jose`,
 * already used for session cookies) exchanged for an OAuth2 access token,
 * then plain `fetch` calls against the Drive REST API v3.
 *
 * Writes go straight into the office's existing folder structure —
 * "נכסים בטיפול רימקס חזון" / {year} / "{street} {building}-{apartment}" —
 * confirmed live and working: GOOGLE_DRIVE_PROPERTIES_ROOT_FOLDER_ID
 * points at that real root, not a separate staging area.
 *
 * A bare service account has zero Drive storage quota of its own and
 * can't create files inside someone else's My Drive folder (verified
 * live against Google's actual error) — so every request here is signed
 * with GOOGLE_DRIVE_IMPERSONATE_EMAIL set as the JWT's subject (domain-
 * wide delegation, granted in the Workspace Admin console for this
 * service account's OAuth Client ID, scope
 * https://www.googleapis.com/auth/drive). Uploads are then charged
 * against and owned by that real account, same as if a person had put
 * them there by hand — that account also needs ordinary Editor sharing
 * on the root folder, delegation alone doesn't grant folder access.
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_API = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
const SCOPE = "https://www.googleapis.com/auth/drive";

function getServiceAccountEmail(): string {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  if (!email) throw new Error("GOOGLE_SERVICE_ACCOUNT_EMAIL is not set");
  return email;
}

/** The console shows the key with literal `\n` escape sequences (it's a
 *  JSON string field) — .env.local keeps it exactly as pasted from that
 *  JSON, so un-escape here rather than asking Levi to hand-edit a PEM
 *  into real line breaks in a single-line env file. */
function getPrivateKeyPem(): string {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY is not set");
  return raw.replace(/\\n/g, "\n");
}

function getRootFolderId(): string {
  const id = process.env.GOOGLE_DRIVE_PROPERTIES_ROOT_FOLDER_ID;
  if (!id) throw new Error("GOOGLE_DRIVE_PROPERTIES_ROOT_FOLDER_ID is not set");
  return id;
}

/** The real account uploads are impersonated as (domain-wide delegation) —
 *  see the file-level doc comment. Required; there's no supported way to
 *  write into the existing folder as the bare service account. */
function getImpersonateEmail(): string {
  const email = process.env.GOOGLE_DRIVE_IMPERSONATE_EMAIL;
  if (!email) throw new Error("GOOGLE_DRIVE_IMPERSONATE_EMAIL is not set");
  return email;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

/** RFC 7523 JWT-bearer flow: sign a short-lived claim set with the service
 *  account's private key, trade it for an OAuth2 access token. Cached in
 *  module scope (like getDynamoDoc/getS3) and refreshed a minute before
 *  actual expiry. */
async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt - 60 > now) return cachedToken.token;

  const privateKey = await importPKCS8(getPrivateKeyPem(), "RS256");
  const assertion = await new SignJWT({ scope: SCOPE })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(getServiceAccountEmail())
    // The impersonated real account, not the service account's own email —
    // this IS the domain-wide delegation: Google honors `sub` as "act as
    // this user" once the Workspace admin has granted it for this
    // service account's Client ID + the drive scope above.
    .setSubject(getImpersonateEmail())
    .setAudience(TOKEN_URL)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey);

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Google OAuth token exchange failed (${res.status}): ${await res.text()}`);
  }
  const body = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: body.access_token, expiresAt: now + body.expires_in };
  return body.access_token;
}

/** Escapes a name for use inside a Drive `files.list` query string's
 *  single-quoted literal (backslash and quote are the only specials). */
function escapeForDriveQuery(name: string): string {
  return name.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/** Looks for an existing child folder by exact name — used so re-running
 *  the path builder (or two agents hitting the same year) doesn't create
 *  duplicate year/property folders alongside ones that already exist in
 *  the real structure. */
async function findFolder(parentId: string, name: string): Promise<string | null> {
  const token = await getAccessToken();
  const q =
    `name = '${escapeForDriveQuery(name)}' and '${parentId}' in parents ` +
    `and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const res = await fetch(`${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=1`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Drive folder lookup failed (${res.status}): ${await res.text()}`);
  }
  const body = (await res.json()) as { files?: Array<{ id: string }> };
  return body.files?.[0]?.id ?? null;
}

async function createFolder(parentId: string, name: string): Promise<string> {
  const token = await getAccessToken();
  const res = await fetch(`${DRIVE_API}/files?fields=id`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Drive folder creation failed (${res.status}): ${await res.text()}`);
  }
  const json = (await res.json()) as { id: string };
  return json.id;
}

async function findOrCreateFolder(parentId: string, name: string): Promise<string> {
  const existing = await findFolder(parentId, name);
  if (existing) return existing;
  return createFolder(parentId, name);
}

/** Resolves (creating as needed) the real `{root}/{year}/{propertyLabel}`
 *  path and returns the property folder's id — callers
 *  (src/lib/store/properties.ts) store it on the PropertyRecord
 *  (`driveFolderId`) so it's only resolved once per listing, not looked
 *  up by name on every subsequent upload.
 *
 *  `year` is the submission year (e.g. new Date().getFullYear()), matching
 *  the existing structure's "year added to the system" folders, not the
 *  property's own listing/build year. `propertyLabel` should match the
 *  existing "{street} {building}-{apartment}" convention where the
 *  address has one — for a project/building-named listing without a
 *  clean street+number, pass whatever label the agent confirms instead. */
export async function ensurePropertyFolder(year: string, propertyLabel: string): Promise<string> {
  const yearFolderId = await findOrCreateFolder(getRootFolderId(), year);
  return findOrCreateFolder(yearFolderId, propertyLabel);
}

/** multipart/related body: a JSON metadata part + the raw file bytes,
 *  built as Buffers throughout so binary content is never coerced through
 *  a JS string (which would corrupt it). */
function buildMultipartBody(
  boundary: string,
  metadata: Record<string, unknown>,
  fileBuffer: Buffer,
  mimeType: string,
): Buffer {
  const metaPart = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
    "utf8",
  );
  const fileHeader = Buffer.from(`--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`, "utf8");
  const closing = Buffer.from(`\r\n--${boundary}--`, "utf8");
  return Buffer.concat([metaPart, fileHeader, fileBuffer, closing]);
}

/** Uploads one file into an existing folder (see ensurePropertyFolder) and
 *  returns the DriveFileRef to store on the PropertyRecord. Uses a plain
 *  multipart upload — fine for typical phone photos and PDFs; if agents'
 *  photos routinely exceed a few MB this should move to Drive's resumable
 *  upload instead (more reliable on flaky mobile connections, no hard
 *  size caveat), a candidate follow-up once real file sizes are seen from
 *  the wizard's media step. */
export async function uploadFileToDrive(folderId: string, file: File): Promise<DriveFileRef> {
  const token = await getAccessToken();
  const buffer = Buffer.from(await file.arrayBuffer());
  const boundary = `agentledger-${randomUUID()}`;
  const body = buildMultipartBody(
    boundary,
    { name: file.name, parents: [folderId] },
    buffer,
    file.type || "application/octet-stream",
  );

  const res = await fetch(`${UPLOAD_API}/files?uploadType=multipart&fields=id,name,webViewLink`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    // Buffer/Uint8Array is a valid fetch BodyInit at runtime (Node's fetch
    // accepts any ArrayBufferView) — the `as` sidesteps a lib.dom/undici
    // BodyInit type mismatch in this project's TS setup, not a real risk.
    body: body as unknown as BodyInit,
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Drive upload failed (${res.status}): ${await res.text()}`);
  }
  const json = (await res.json()) as { id: string; name: string; webViewLink: string };
  return {
    driveFileId: json.id,
    name: json.name,
    webViewLink: json.webViewLink,
    uploadedAt: new Date().toISOString(),
  };
}
