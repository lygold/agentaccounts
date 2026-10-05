"use server";

import { randomUUID } from "node:crypto";
import { requireSession } from "@/lib/auth/session-cookie";
import { loadPropertyDraft, patchPropertyDraft } from "@/lib/property-wizard/draft";
import { completeUpload, createUploadTarget, getMediaUrl } from "@/lib/storage/media";
import type { MediaFileRef, PropertyMedia, PropertyMediaCategory } from "@/lib/types";

const CATEGORIES: PropertyMediaCategory[] = ["mainPhotos", "additionalPhotos", "forms", "documents"];

export type RequestUploadResult =
  | { ok: true; url: string; headers: Record<string, string>; key: string }
  | { ok: false; error: string };

export type FinalizeUploadResult =
  | { ok: true; name: string; thumbUrl: string | null }
  | { ok: false; error: string };

/** Step 1 of a browser upload: returns a presigned PUT into this draft's
 *  media folder (allocating the folder id on first use). */
export async function requestMediaUpload(file: {
  name: string;
  type: string;
  size: number;
}): Promise<RequestUploadResult> {
  try {
    const session = await requireSession();
    const draft = await loadPropertyDraft(session.agentId);
    const folderId = draft.mediaFolderId ?? randomUUID();
    if (!draft.mediaFolderId) await patchPropertyDraft(session.agentId, { mediaFolderId: folderId });

    const target = await createUploadTarget(session.officeId, folderId, file);
    return { ok: true, url: target.url, headers: target.headers, key: target.key };
  } catch (e) {
    console.error("requestMediaUpload failed:", e);
    return { ok: false, error: e instanceof Error ? e.message : "Upload failed" };
  }
}

/** Step 2: after the browser's PUT — verify, resize, and record the file on
 *  the draft. The client calls this sequentially (the draft is a Redis
 *  read-modify-write blob). */
export async function finalizeMediaUpload(
  category: PropertyMediaCategory,
  key: string,
  file: { name: string; type: string },
): Promise<FinalizeUploadResult> {
  try {
    if (!CATEGORIES.includes(category)) throw new Error("Unknown media category");
    const session = await requireSession();
    const ref: MediaFileRef = await completeUpload(session.officeId, key, file);

    const draft = await loadPropertyDraft(session.agentId);
    const media: PropertyMedia = {
      mainPhotos: [],
      additionalPhotos: [],
      forms: [],
      documents: [],
      ...draft.media,
    };
    media[category] = [...media[category], ref];
    await patchPropertyDraft(session.agentId, { media });

    return { ok: true, name: ref.name, thumbUrl: ref.thumbKey ? await getMediaUrl(ref, "thumb") : null };
  } catch (e) {
    console.error("finalizeMediaUpload failed:", e);
    return { ok: false, error: e instanceof Error ? e.message : "Upload failed" };
  }
}
