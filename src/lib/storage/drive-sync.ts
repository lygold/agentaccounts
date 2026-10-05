import "server-only";
import { randomUUID } from "node:crypto";
import { getAccessToken } from "../google-drive";
import { getRedis } from "../redis";
import { getProperty, updateProperty } from "../store/properties";
import type { MediaFileRef, PropertyMedia, PropertyRecord } from "../types";
import { buildOriginalKey } from "./keys";
import { MAX_UPLOAD_BYTES, completeUpload, getStorage } from "./media";

/**
 * Lazy per-property Drive -> storage backfill (docs/reference/storage-architecture.md,
 * "Existing Drive media"). The office's real Drive structure is
 * `{root}/{year}/{street} {building}-{apt}/…`; the secretary keeps adding
 * photos there, so each sync copies only files that are new or changed (by
 * Drive `md5Checksum`) and never modifies or deletes anything in Drive.
 * A file removed from Drive keeps our copy, flagged `driveMissing`.
 */

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const FOLDER_MIME = "application/vnd.google-apps.folder";
/** Files copied per call, so a big folder can't time out one request. */
export const SYNC_BATCH_SIZE = 6;
/** Don't re-list Drive for a property more often than this on plain page loads. */
export const SYNC_TTL_MS = 10 * 60 * 1000;
const INDEX_TTL_MS = 10 * 60 * 1000;
const LOCK_TTL_SECONDS = 120;
/** Marker the Drive-backup export sets on files it writes, so we never
 *  re-import our own backup copies (appProperties key). */
export const BACKUP_MARKER_PROPERTY = "agentledgerKey";

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  md5Checksum?: string;
  modifiedTime?: string;
  appProperties?: Record<string, string>;
}

async function driveList(q: string, fields: string, pageToken?: string) {
  const params = new URLSearchParams({
    q,
    fields: `nextPageToken, files(${fields})`,
    pageSize: "1000",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  });
  if (pageToken) params.set("pageToken", pageToken);
  // Drive intermittently answers 500 on files.list — retry with backoff.
  for (let attempt = 1; ; attempt++) {
    const token = await getAccessToken();
    const res = await fetch(`${DRIVE_API}/files?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (res.ok) return (await res.json()) as { files: DriveFile[]; nextPageToken?: string };
    if (attempt >= 4 || (res.status < 500 && res.status !== 429)) {
      throw new Error(`Drive list failed (${res.status})`);
    }
    await new Promise((r) => setTimeout(r, 1000 * attempt));
  }
}

async function driveListAll(q: string, fields: string): Promise<DriveFile[]> {
  const out: DriveFile[] = [];
  let pageToken: string | undefined;
  do {
    const page = await driveList(q, fields, pageToken);
    out.push(...page.files);
    pageToken = page.nextPageToken;
  } while (pageToken);
  return out;
}

// ---------- folder index ----------

/** Normalises Hebrew punctuation variants and whitespace so "ז'בוטינסקי",
 *  "ז׳בוטינסקי" and double spaces all compare equal. */
export function normalizeName(s: string): string {
  return s
    .normalize("NFC")
    .replace(/[׳’‘`´]/g, "'")
    .replace(/[״“”]/g, '"')
    .replace(/[־–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

interface FolderEntry {
  id: string;
  name: string;
  year: number;
}

let indexCache: { at: number; byName: Map<string, FolderEntry[]> } | null = null;

/** Every property folder under the real root, newest year first. Built once
 *  and cached in memory (≈ a handful of Drive calls); skips the 2023-style
 *  status folders ("B נמכר+הושכר", …). */
async function getFolderIndex(): Promise<Map<string, FolderEntry[]>> {
  if (indexCache && Date.now() - indexCache.at < INDEX_TTL_MS) return indexCache.byName;
  const root = process.env.GOOGLE_DRIVE_LEGACY_ROOT_FOLDER_ID;
  if (!root) throw new Error("GOOGLE_DRIVE_LEGACY_ROOT_FOLDER_ID is not set");

  const children = await driveListAll(`'${root}' in parents and trashed = false and mimeType = '${FOLDER_MIME}'`, "id,name");
  const years = children
    .filter((f) => /^\d{4}$/.test(f.name))
    .map((f) => ({ id: f.id, year: Number(f.name) }))
    .sort((a, b) => b.year - a.year);

  const byName = new Map<string, FolderEntry[]>();
  for (const y of years) {
    const props = await driveListAll(`'${y.id}' in parents and trashed = false and mimeType = '${FOLDER_MIME}'`, "id,name");
    for (const p of props) {
      if (/^[A-Za-z]\s/.test(p.name)) continue; // status folders
      const key = normalizeName(p.name);
      const list = byName.get(key) ?? [];
      list.push({ id: p.id, name: p.name, year: y.year });
      byName.set(key, list);
    }
  }
  indexCache = { at: Date.now(), byName };
  return byName;
}

/** Folder-name candidates for an address, most specific first. The office
 *  uses "{street} {building}-{apt}", "-0" when there is no apartment, and
 *  sometimes just "{street} {building}". */
export function folderNameCandidates(p: Pick<PropertyRecord, "street" | "buildingNumber" | "apartmentNumber">): string[] {
  if (!p.street || !p.buildingNumber) return [];
  const base = `${p.street} ${p.buildingNumber}`;
  const names = p.apartmentNumber ? [`${base}-${p.apartmentNumber}`] : [`${base}-0`, base];
  return names.map(normalizeName);
}

export async function findDriveFolder(
  p: Pick<PropertyRecord, "street" | "buildingNumber" | "apartmentNumber">,
): Promise<FolderEntry | null> {
  const index = await getFolderIndex();
  for (const name of folderNameCandidates(p)) {
    const hits = index.get(name);
    if (hits?.length) return hits[0]; // already newest-year-first
  }
  return null;
}

// ---------- sync ----------

export interface SyncResult {
  status: "no_match" | "in_progress" | "locked" | "up_to_date";
  copied: number;
  remaining: number;
  total: number;
  folderName?: string;
}

function emptyMedia(m?: PropertyMedia): PropertyMedia {
  return { mainPhotos: [], additionalPhotos: [], forms: [], documents: [], ...m };
}

function allRefs(m: PropertyMedia): MediaFileRef[] {
  return [...m.mainPhotos, ...m.additionalPhotos, ...m.forms, ...m.documents];
}

/** Drive has no "main photo"; images go to additionalPhotos, everything else
 *  to documents. The agent can still pick a main photo later. */
function categoryFor(mime: string): "additionalPhotos" | "documents" {
  return mime.startsWith("image/") ? "additionalPhotos" : "documents";
}

async function downloadDriveFile(id: string): Promise<Buffer> {
  const token = await getAccessToken();
  const res = await fetch(`${DRIVE_API}/files/${id}?alt=media&supportsAllDrives=true`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Drive download failed (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

/** Copies up to SYNC_BATCH_SIZE new/changed Drive files for one property into
 *  storage. Call repeatedly until `remaining` is 0. Throws nothing for
 *  per-file failures (they're logged and retried on the next sync). */
export async function syncPropertyFromDrive(
  propertyId: string,
  officeId: string,
  opts: { force?: boolean } = {},
): Promise<SyncResult> {
  const redis = getRedis();
  const lockKey = `al:drive-sync:lock:${propertyId}`;
  const gotLock = await redis.set(lockKey, "1", { nx: true, ex: LOCK_TTL_SECONDS });
  if (!gotLock) return { status: "locked", copied: 0, remaining: 0, total: 0 };

  try {
    const property = await getProperty(propertyId);
    if (!property || property.officeId !== officeId) throw new Error("Property not found");

    if (
      !opts.force &&
      property.driveSyncedAt &&
      Date.now() - Date.parse(property.driveSyncedAt) < SYNC_TTL_MS
    ) {
      return { status: "up_to_date", copied: 0, remaining: 0, total: 0 };
    }

    const folder = await findDriveFolder(property);
    if (!folder) {
      await updateProperty(propertyId, { driveMatch: "not_found", driveSyncedAt: new Date().toISOString() }, officeId);
      return { status: "no_match", copied: 0, remaining: 0, total: 0 };
    }

    const listing = (
      await driveListAll(
        `'${folder.id}' in parents and trashed = false and mimeType != '${FOLDER_MIME}'`,
        "id,name,mimeType,size,md5Checksum,modifiedTime,appProperties",
      )
    ).filter(
      (f) =>
        !f.mimeType.startsWith("application/vnd.google-apps.") && // Docs/Sheets: no bytes to copy
        !f.appProperties?.[BACKUP_MARKER_PROPERTY], // our own backup copies
    );

    const media = emptyMedia(property.media);
    const existing = allRefs(media);
    const byDriveId = new Map(existing.filter((r) => r.driveFileId).map((r) => [r.driveFileId!, r]));

    const todo = listing.filter((f) => {
      const have = byDriveId.get(f.id);
      return !have || (f.md5Checksum && have.driveMd5 !== f.md5Checksum);
    });
    const batch = todo.slice(0, SYNC_BATCH_SIZE);
    const storage = getStorage();
    const mediaFolderId = property.mediaFolderId ?? property.id;
    let copied = 0;

    for (const f of batch) {
      try {
        if (Number(f.size ?? 0) > MAX_UPLOAD_BYTES) {
          console.warn(`[drive-sync] skipping ${f.name}: larger than ${MAX_UPLOAD_BYTES} bytes`);
          continue;
        }
        const body = await downloadDriveFile(f.id);
        const key = buildOriginalKey(officeId, mediaFolderId, randomUUID(), f.name);
        await storage.putObject(key, body, f.mimeType);
        const ref = await completeUpload(officeId, key, { name: f.name, type: f.mimeType });
        ref.source = "drive";
        ref.driveFileId = f.id;
        ref.driveMd5 = f.md5Checksum;
        ref.driveModifiedTime = f.modifiedTime;

        // A changed file replaces its previous copy's ref (old objects are orphaned).
        for (const cat of Object.keys(media) as Array<keyof PropertyMedia>) {
          media[cat] = media[cat].filter((r) => r.driveFileId !== f.id);
        }
        media[categoryFor(f.mimeType)].push(ref);
        copied++;
      } catch (e) {
        console.error(`[drive-sync] ${f.name} failed:`, e);
      }
    }

    // Files that vanished from Drive keep our copy, flagged.
    const liveIds = new Set(listing.map((f) => f.id));
    for (const cat of Object.keys(media) as Array<keyof PropertyMedia>) {
      media[cat] = media[cat].map((r) =>
        r.source === "drive" && r.driveFileId ? { ...r, driveMissing: !liveIds.has(r.driveFileId) || undefined } : r,
      );
    }

    const remaining = Math.max(0, todo.length - batch.length);
    const patch: Partial<PropertyRecord> = {
      media,
      mediaFolderId,
      driveFolderId: folder.id,
      driveMatch: "found",
    };
    if (remaining === 0) patch.driveSyncedAt = new Date().toISOString();
    await updateProperty(propertyId, patch, officeId);

    return {
      status: remaining > 0 ? "in_progress" : "up_to_date",
      copied,
      remaining,
      total: listing.length,
      folderName: folder.name,
    };
  } finally {
    await redis.del(lockKey);
  }
}
