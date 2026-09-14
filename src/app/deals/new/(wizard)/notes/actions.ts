"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session-cookie";
import { advanceDraft } from "@/lib/wizard/draft";
import { destinationStep, stepHref, WIZARD_DESTINATION_FIELD } from "@/lib/wizard/steps";
import { isNextJsRedirect } from "@/lib/wizard/action-utils";

const Schema = z.object({
  notes: z.string().trim().max(5000).optional(),
});

export async function submitNotes(formData: FormData) {
  try {
    const session = await requireSession();
    const parsed = Schema.safeParse({ notes: formData.get("notes") });
    if (!parsed.success) return;

    await advanceDraft(session.agentId, "notes", {
      notes: parsed.data.notes || undefined,
    });
    const destination = formData.get(WIZARD_DESTINATION_FIELD);
    redirect(
      stepHref(
        destinationStep(
          "notes",
          typeof destination === "string" ? destination : null,
        ),
      ),
    );
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("submitNotes failed:", e);
    redirect(stepHref("notes") + "?error=save");
  }
}
