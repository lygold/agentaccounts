"use server";

import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session-cookie";
import { loadPropertyDraft } from "@/lib/property-wizard/draft";
import { saveStepOrReportMissing } from "@/lib/property-wizard/gate";
import { propertyStepHref } from "@/lib/property-wizard/steps";
import { parseYesNo } from "@/lib/yes-no";
import { isNextJsRedirect } from "@/lib/wizard/action-utils";

/** Files are uploaded browser -> storage as they're picked (see
 *  components/media-uploader.tsx + ./upload-actions.ts), so this action only
 *  saves the copyright/renderings answers and links, checks the mandatory
 *  photos/forms are in, then advances. */
export async function submitPropertyMedia(formData: FormData) {
  try {
    const session = await requireSession();
    const draft = await loadPropertyDraft(session.agentId);
    if (!draft.street || !draft.buildingNumber) {
      redirect(propertyStepHref("address"));
    }

    const str = (name: string) => (formData.get(name) as string | null)?.trim() || undefined;

    await saveStepOrReportMissing(session.agentId, "media", {
      copyrightConfirmed: parseYesNo(formData.get("copyrightConfirmed")),
      renderingsConfirmed: parseYesNo(formData.get("renderingsConfirmed")),
      virtualTourUrl: str("virtualTourUrl"),
      youtubeUrl: str("youtubeUrl"),
      youtubeDisplayText: str("youtubeDisplayText"),
    });
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("submitPropertyMedia failed:", e);
    redirect(propertyStepHref("media") + "?error=save");
  }
}
