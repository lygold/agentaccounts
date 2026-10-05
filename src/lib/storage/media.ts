import "server-only";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import type { MediaFileRef } from "../types";
import {
  assertKeyBelongsToOffice,
  buildOriginalKey,
  variantKey,
  type MediaVariant,
} from "./keys";
import type { PresignedUpload, StorageProvider } from "./provider";
import { s3Provider } from "./s3-provider";
import { cdnSignedUrl } from "./cdn";

/**
 * Tenant media: browser -> storage uploads via presigned PUT, then a server
 * step that validates the object and writes resized derivatives. Reads hand
 * out short-lived signed URLs (CloudFront-signed once the CDN is in place;
 * presigned storage URLs until then). See docs/reference/storage-architecture.md.
 */

/** Swappable backend; S3 today. */
export function getStorage(): StorageProvider {
  return s3Provider;
}

export const MAX_UPLOAD_BYTES = 40 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const DOCUMENT_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const DERIVATIVES = {
  gallery: { width: 1600, quality: 80 },
  thumb: { width: 400, quality: 75 },
} as const;

export interface UploadTarget extends PresignedUpload {
  /** Echo back to completeUpload() once the browser's PUT succeeds. */
  mediaId: string;
}

/** Step 1: validate the declared file and hand the browser a presigned PUT. */
export async function createUploadTarget(
  officeId: string,
  propertyId: string,
  file: { name: string; type: string; size: number },
): Promise<UploadTarget> {
  if (!IMAGE_TYPES.has(file.type) && !DOCUMENT_TYPES.has(file.type)) {
    throw new Error(`Unsupported file type: ${file.type || "unknown"}`);
  }
  if (!Number.isFinite(file.size) || file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
    throw new Error("File is empty or too large");
  }
  const mediaId = randomUUID();
  const key = buildOriginalKey(officeId, propertyId, mediaId, file.name);
  const target = await getStorage().presignPut(key, file.type, file.size);
  return { ...target, mediaId };
}

/** Step 2 (after the browser's PUT): verify the object is really there and
 *  within bounds, generate derivatives for images, return the record to store
 *  on the property. `key` comes from the client, so it is tenant-checked. */
export async function completeUpload(
  officeId: string,
  key: string,
  meta: { name: string; type: string },
): Promise<MediaFileRef> {
  const parsed = assertKeyBelongsToOffice(key, officeId);
  if (parsed.variant !== "original") throw new Error("Not an original upload key");

  const storage = getStorage();
  const head = await storage.headObject(key);
  if (!head) throw new Error("Upload not found in storage");
  if (head.size > MAX_UPLOAD_BYTES) throw new Error("Uploaded file is too large");

  const ref: MediaFileRef = {
    s3Key: key,
    name: meta.name,
    contentType: meta.type,
    size: head.size,
    uploadedAt: new Date().toISOString(),
    source: "upload",
  };

  if (IMAGE_TYPES.has(meta.type)) {
    const derivatives = await generateDerivatives(key);
    ref.galleryKey = derivatives.galleryKey;
    ref.thumbKey = derivatives.thumbKey;
  }
  return ref;
}

/** Server-side counterpart of the browser upload flow: stores bytes the
 *  server already holds (e.g. a contract PDF fetched from Monday) and returns
 *  the same MediaFileRef. */
export async function storeServerFile(
  officeId: string,
  folderId: string,
  file: { name: string; type: string; buffer: Buffer },
): Promise<MediaFileRef> {
  if (!IMAGE_TYPES.has(file.type) && !DOCUMENT_TYPES.has(file.type)) {
    throw new Error(`Unsupported file type: ${file.type || "unknown"}`);
  }
  if (file.buffer.length === 0 || file.buffer.length > MAX_UPLOAD_BYTES) {
    throw new Error("File is empty or too large");
  }
  const key = buildOriginalKey(officeId, folderId, randomUUID(), file.name);
  await getStorage().putObject(key, file.buffer, file.type);
  return completeUpload(officeId, key, { name: file.name, type: file.type });
}

/** Reads the original from storage and writes the gallery + thumb WebP copies.
 *  Also used by the Drive -> S3 backfill. Idempotent (same keys each run). */
export async function generateDerivatives(
  originalKey: string,
): Promise<{ galleryKey: string; thumbKey: string }> {
  const storage = getStorage();
  const { body } = await storage.getObject(originalKey);

  const galleryKey = variantKey(originalKey, "gallery");
  const thumbKey = variantKey(originalKey, "thumb");

  for (const [variant, key] of [
    ["gallery", galleryKey],
    ["thumb", thumbKey],
  ] as const) {
    const spec = DERIVATIVES[variant];
    const out = await sharp(body, { limitInputPixels: 268_402_689 })
      .rotate() // apply EXIF orientation, then drop the tag
      .resize({ width: spec.width, withoutEnlargement: true })
      .webp({ quality: spec.quality })
      .toBuffer();
    await storage.putObject(key, out, "image/webp");
  }
  return { galleryKey, thumbKey };
}

/** Signed read URL for one stored file, picking the right object per variant
 *  and falling back to the original when no derivative exists (e.g. a PDF, or
 *  the resize hasn't run). Short-lived; generate per render, never persist. */
export async function getMediaUrl(
  ref: Pick<MediaFileRef, "s3Key" | "galleryKey" | "thumbKey">,
  variant: MediaVariant = "gallery",
  expiresIn = 3600,
): Promise<string> {
  const key =
    variant === "thumb" ? ref.thumbKey ?? ref.s3Key : variant === "gallery" ? ref.galleryKey ?? ref.s3Key : ref.s3Key;
  return cdnSignedUrl(key, expiresIn) ?? getStorage().presignGet(key, expiresIn);
}
