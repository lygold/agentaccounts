"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session-cookie";
import { advanceDraft } from "@/lib/wizard/draft";
import { destinationStep, stepHref, WIZARD_DESTINATION_FIELD } from "@/lib/wizard/steps";
import { isNextJsRedirect } from "@/lib/wizard/action-utils";

const Schema = z.object({
  signingDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("")),
});

export async function submitSigningDate(formData: FormData) {
  try {
    const session = await requireSession();
    const parsed = Schema.safeParse({
      signingDate: formData.get("signingDate") || undefined,
    });
    if (!parsed.success) return;
    await advanceDraft(session.agentId, "signing-date", {
      signingDate:
        parsed.data.signingDate && parsed.data.signingDate !== ""
          ? parsed.data.signingDate
          : undefined,
    });
    const destination = formData.get(WIZARD_DESTINATION_FIELD);
    redirect(
      stepHref(
        destinationStep(
          "signing-date",
          typeof destination === "string" ? destination : null,
        ),
      ),
    );
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("submitSigningDate failed:", e);
    redirect(stepHref("signing-date") + "?error=save");
  }
}
