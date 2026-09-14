"use server";

import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session-cookie";
import { advanceDraft } from "@/lib/wizard/draft";
import { CommissionReferralSchema, MainCommissionSchema } from "@/lib/wizard/form-parse";
import { destinationStep, stepHref, WIZARD_DESTINATION_FIELD } from "@/lib/wizard/steps";
import { isNextJsRedirect } from "@/lib/wizard/action-utils";
import type { CommissionInput } from "@/lib/wizard/draft";

export async function submitOwnerCommission(formData: FormData) {
  try {
    const session = await requireSession();

    const mainParsed = MainCommissionSchema.safeParse({
      unit: formData.get("unit"),
      amount: formData.get("amount"),
      vatMode: formData.get("vatMode"),
    });
    if (!mainParsed.success) return;

    // An incomplete referral (e.g. required phone left blank) is dropped
    // rather than failing the whole step — otherwise the agent's already-
    // valid main commission entry would silently never save. Same "drop the
    // invalid bit, don't block progress" spirit as the owners/buyers steps.
    let referral: CommissionInput["referral"];
    if (formData.get("hasReferral") === "yes") {
      const referralParsed = CommissionReferralSchema.safeParse({
        agentName: formData.get("referralAgentName"),
        officeName: formData.get("referralOfficeName"),
        phone: formData.get("referralPhone"),
        unit: formData.get("referralUnit"),
        amount: formData.get("referralAmount"),
        vatMode: formData.get("referralVatMode"),
      });
      if (referralParsed.success) referral = referralParsed.data;
    }

    await advanceDraft(session.agentId, "owner-commission", {
      ownerCommission: { ...mainParsed.data, referral },
    });

    const destination = formData.get(WIZARD_DESTINATION_FIELD);
    redirect(
      stepHref(
        destinationStep("owner-commission", typeof destination === "string" ? destination : null),
      ),
    );
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("submitOwnerCommission failed:", e);
    redirect(stepHref("owner-commission") + "?error=save");
  }
}
