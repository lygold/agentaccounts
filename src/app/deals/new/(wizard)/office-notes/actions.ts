"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session-cookie";
import { advanceDraft } from "@/lib/wizard/draft";
import { destinationStep, stepHref, WIZARD_DESTINATION_FIELD } from "@/lib/wizard/steps";
import { isNextJsRedirect } from "@/lib/wizard/action-utils";

const Schema = z.object({
  officeNotes: z.string().trim().max(5000).optional(),
});

export async function submitOfficeNotes(formData: FormData) {
  try {
    const session = await requireSession();
    const parsed = Schema.safeParse({
      officeNotes: formData.get("officeNotes"),
    });
    if (!parsed.success) return;

    await advanceDraft(session.agentId, "office-notes", {
      officeNotes: parsed.data.officeNotes || undefined,
    });
    const destination = formData.get(WIZARD_DESTINATION_FIELD);
    redirect(
      stepHref(
        destinationStep(
          "office-notes",
          typeof destination === "string" ? destination : null,
        ),
      ),
    );
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("submitOfficeNotes failed:", e);
    redirect(stepHref("office-notes") + "?error=save");
  }
}
