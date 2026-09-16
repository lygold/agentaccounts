"use server";

import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session-cookie";
import { advancePropertyDraft, loadPropertyDraft } from "@/lib/property-wizard/draft";
import { ensurePropertyFolder, uploadFileToDrive } from "@/lib/google-drive";
import { nextPropertyStep, propertyStepHref } from "@/lib/property-wizard/steps";
import { isNextJsRedirect } from "@/lib/wizard/action-utils";
import type { DriveFileRef } from "@/lib/types";

async function uploadAll(folderId: string, files: File[]): Promise<DriveFileRef[]> {
  const refs: DriveFileRef[] = [];
  for (const file of files) {
    if (!file || file.size === 0) continue; // empty <input type=file> slot
    refs.push(await uploadFileToDrive(folderId, file));
  }
  return refs;
}

export async function submitPropertyMedia(formData: FormData) {
  try {
    const session = await requireSession();
    const draft = await loadPropertyDraft(session.agentId);
    if (!draft.street || !draft.buildingNumber) {
      redirect(propertyStepHref("address"));
    }

    // Resolved once per listing and cached on the draft — a revisit to add
    // more photos reuses the same Drive folder instead of creating a
    // second one (see ensurePropertyFolder's own doc comment).
    let folderId = draft.driveFolderId;
    if (!folderId) {
      const label = `${draft.street} ${draft.buildingNumber}${draft.apartmentNumber ? `-${draft.apartmentNumber}` : ""}`;
      folderId = await ensurePropertyFolder(String(new Date().getFullYear()), label);
    }

    const [newMain, newAdditional, newForms, newDocuments] = await Promise.all([
      uploadAll(folderId, formData.getAll("mainPhotos") as File[]),
      uploadAll(folderId, formData.getAll("additionalPhotos") as File[]),
      uploadAll(folderId, formData.getAll("forms") as File[]),
      uploadAll(folderId, formData.getAll("documents") as File[]),
    ]);

    const str = (name: string) => (formData.get(name) as string | null)?.trim() || undefined;

    await advancePropertyDraft(session.agentId, "media", {
      driveFolderId: folderId,
      mainPhotos: [...(draft.mainPhotos ?? []), ...newMain],
      additionalPhotos: [...(draft.additionalPhotos ?? []), ...newAdditional],
      forms: [...(draft.forms ?? []), ...newForms],
      documents: [...(draft.documents ?? []), ...newDocuments],
      copyrightConfirmed: formData.get("copyrightConfirmed") === "on",
      renderingsConfirmed: formData.get("renderingsConfirmed") === "on",
      virtualTourUrl: str("virtualTourUrl"),
      youtubeUrl: str("youtubeUrl"),
      youtubeDisplayText: str("youtubeDisplayText"),
    });
    redirect(propertyStepHref(nextPropertyStep("media")!));
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("submitPropertyMedia failed:", e);
    redirect(propertyStepHref("media") + "?error=save");
  }
}
