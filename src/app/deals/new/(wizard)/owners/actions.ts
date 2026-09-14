"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth/session-cookie";
import { advanceDraft } from "@/lib/wizard/draft";
import { PersonSchema, parsePersons } from "@/lib/wizard/form-parse";
import { destinationStep, stepHref, WIZARD_DESTINATION_FIELD } from "@/lib/wizard/steps";
import {
  type WizardActionResult,
  isNextJsRedirect,
} from "@/lib/wizard/action-utils";

const Schema = z.object({
  communicationLang: z.enum(["hebrew", "english"]).optional(),
});

export async function submitOwners(
  _prev: WizardActionResult,
  formData: FormData,
): Promise<WizardActionResult> {
  try {
    const session = await requireSession();
    const parsed = Schema.safeParse({
      communicationLang: formData.get("communicationLang") || undefined,
    });
    if (!parsed.success) return;

    const rawPersons = parsePersons(formData);
    const owners = rawPersons
      .map((p) => PersonSchema.safeParse(p))
      .filter((r) => r.success)
      .map((r) => r.data);

    await advanceDraft(session.agentId, "owners", {
      owners,
      ownerCommunicationLang: parsed.data.communicationLang,
    });

    const destination = formData.get(WIZARD_DESTINATION_FIELD);
    redirect(
      stepHref(
        destinationStep(
          "owners",
          typeof destination === "string" ? destination : null,
        ),
      ),
    );
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("submitOwners failed:", e);
    const t = await getTranslations("Common");
    return {
      ok: false,
      message: t("saveFailed"),
    };
  }
}
