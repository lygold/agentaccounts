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
 * IMPORTANT operational caveat, confirm before relying on this in prod:
 * a bare service account (no domain-wide delegation) owns files it
 * creates itself and has **zero personal storage quota** unless the
 * target folder lives inside a Shared Drive (a Drive "shared drive" /
 * legacy Team Drive, which has pooled org storage, not a regular folder
 * under someone's My Drive that's merely *shared* with the service
 * account). If GOOGLE_DRIVE_PROPERTIES_ROOT_FOLDER_ID points at a normal
 * My Drive folder, uploads will likely fail with a storage-quota error
 * the first time a real file is written — verified via a manual
 * round-trip test before wiring this into the wizard (see chat/ROADMAP).
 * If that happens, the fix is moving the root folder into a Shared Drive
 * the service account is a member of, not a code change here.
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
    .setSubject(getServiceAccountEmail())
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

/** Creates a new folder under the properties root and returns its id.
 *  Callers (src/lib/store/properties.ts) store the id on the
 *  PropertyRecord (`driveFolderId`) so it's only created once per
 *  listing, not looked up by name on every upload. */
export async function createPropertyFolder(label: string): Promise<string> {
  const token = await getAccessToken();
  const res = await fetch(`${DRIVE_API}/files?fields=id`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: label,
      mimeType: "application/vnd.google-apps.folder",
      parents: [getRootFolderId()],
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Drive folder creation failed (${res.status}): ${await res.text()}`);
  }
  const json = (await res.json()) as { id: string };
  return json.id;
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

/** Uploads one file into an existing folder (see createPropertyFolder) and
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
