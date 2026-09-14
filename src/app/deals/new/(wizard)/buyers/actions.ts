"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth/session-cookie";
import { advanceDraft } from "@/lib/wizard/draft";
import { PersonSchema, parsePersons } from "@/lib/wizard/form-parse";
import { notifyClientSelected } from "@/lib/wizard/monday";
import { destinationStep, stepHref, WIZARD_DESTINATION_FIELD } from "@/lib/wizard/steps";
import {
  type WizardActionResult,
  isNextJsRedirect,
} from "@/lib/wizard/action-utils";

const Schema = z.object({
  communicationLang: z.enum(["hebrew", "english"]).optional(),
});

export async function submitBuyers(
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
    const buyers = rawPersons
      .map((p) => PersonSchema.safeParse(p))
      .filter((r) => r.success)
      .map((r) => r.data);

    // Carried through to submitDeal(), which marks the offer Accepted once
    // the deal is actually submitted — not here, since the agent could still
    // back out of the wizard before submitting.
    const selectedOfferIdRaw = formData.get("selectedOfferId");
    const selectedOfferId =
      typeof selectedOfferIdRaw === "string" && selectedOfferIdRaw
        ? selectedOfferIdRaw
        : null;

    await advanceDraft(session.agentId, "buyers", {
      buyers,
      buyerCommunicationLang: parsed.data.communicationLang,
      selectedOfferId,
    });

    // If the agent picked a client from the Monday board, notify it (placeholder
    // until the target column is added to the clients board in v1.5).
    const selectedClientId = formData.get("selectedClientId");
    if (selectedClientId && typeof selectedClientId === "string") {
      notifyClientSelected(selectedClientId).catch((err) =>
        console.error("notifyClientSelected failed:", err),
      );
    }

    const destination = formData.get(WIZARD_DESTINATION_FIELD);
    redirect(
      stepHref(
        destinationStep(
          "buyers",
          typeof destination === "string" ? destination : null,
        ),
      ),
    );
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("submitBuyers failed:", e);
    const t = await getTranslations("Common");
    return {
      ok: false,
      message: t("saveFailed"),
    };
  }
}
