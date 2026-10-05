/**
 * Object-key rules for tenant media in the storage bucket. Pure (no I/O) so
 * it can be used from server code and scripts alike.
 *
 *   media/{officeId}/{propertyId}/original/{uuid}-{safeName}
 *   media/{officeId}/{propertyId}/gallery/{uuid}.webp
 *   media/{officeId}/{propertyId}/thumb/{uuid}.webp
 *
 * See docs/reference/storage-architecture.md. Tenant isolation is the
 * `{officeId}` prefix plus assertKeyBelongsToOffice() on every key that
 * arrives from a client.
 */

export type MediaVariant = "original" | "gallery" | "thumb";

const SEGMENT = /^[A-Za-z0-9_-]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function assertSegment(value: string, label: string): void {
  if (!SEGMENT.test(value)) throw new Error(`Invalid ${label} for a storage key`);
}

export function safeFileName(name: string): string {
  const cleaned = name.replace(/[^\w.\-]+/g, "_").replace(/^\.+/, "");
  return cleaned.slice(-120) || "file";
}

export function buildOriginalKey(
  officeId: string,
  propertyId: string,
  id: string,
  fileName: string,
): string {
  assertSegment(officeId, "officeId");
  assertSegment(propertyId, "propertyId");
  if (!UUID.test(id)) throw new Error("Invalid media id");
  return `media/${officeId}/${propertyId}/original/${id}-${safeFileName(fileName)}`;
}

export interface ParsedMediaKey {
  officeId: string;
  propertyId: string;
  variant: MediaVariant;
  id: string;
}

export function parseMediaKey(key: string): ParsedMediaKey | null {
  const parts = key.split("/");
  if (parts.length !== 5 || parts[0] !== "media") return null;
  const [, officeId, propertyId, variant, leaf] = parts;
  if (!SEGMENT.test(officeId) || !SEGMENT.test(propertyId)) return null;
  if (variant !== "original" && variant !== "gallery" && variant !== "thumb") return null;
  const id = leaf.slice(0, 36);
  if (!UUID.test(id)) return null;
  return { officeId, propertyId, variant, id };
}

/** Throws unless `key` is a well-formed media key inside `officeId`'s prefix.
 *  Call on every key received from the browser before touching storage. */
export function assertKeyBelongsToOffice(key: string, officeId: string): ParsedMediaKey {
  const parsed = parseMediaKey(key);
  if (!parsed || parsed.officeId !== officeId) {
    throw new Error("Storage key does not belong to this office");
  }
  return parsed;
}

/** The derivative key for an original, e.g. original -> gallery/{uuid}.webp. */
export function variantKey(originalKey: string, variant: Exclude<MediaVariant, "original">): string {
  const p = parseMediaKey(originalKey);
  if (!p || p.variant !== "original") throw new Error("Not an original media key");
  return `media/${p.officeId}/${p.propertyId}/${variant}/${p.id}.webp`;
}
