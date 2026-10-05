"use server";

import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session-cookie";
import { advancePropertyDraft, loadPropertyDraft } from "@/lib/property-wizard/draft";
import { nextPropertyStep, propertyStepHref } from "@/lib/property-wizard/steps";
import { isNextJsRedirect } from "@/lib/wizard/action-utils";

/** Files are uploaded browser -> storage as they're picked (see
 *  components/media-uploader.tsx + ./upload-actions.ts), so this action only
 *  saves the confirmations and links, then advances. */
export async function submitPropertyMedia(formData: FormData) {
  try {
    const session = await requireSession();
    const draft = await loadPropertyDraft(session.agentId);
    if (!draft.street || !draft.buildingNumber) {
      redirect(propertyStepHref("address"));
    }

    const str = (name: string) => (formData.get(name) as string | null)?.trim() || undefined;

    await advancePropertyDraft(session.agentId, "media", {
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
