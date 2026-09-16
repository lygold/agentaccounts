"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session-cookie";
import { advancePropertyDraft } from "@/lib/property-wizard/draft";
import { nextPropertyStep, propertyStepHref } from "@/lib/property-wizard/steps";
import { isNextJsRedirect } from "@/lib/wizard/action-utils";

const Schema = z.object({
  propertyType: z.string().trim().optional(),
  referralSource: z.string().trim().optional(),
  referralSourceOther: z.string().trim().optional(),
  externalReferringAgentName: z.string().trim().optional(),
  externalReferringAgentOffice: z.string().trim().optional(),
  externalReferringAgentPhone: z.string().trim().optional(),
  referralPercentOfCommission: z.coerce.number().min(0).max(100).optional().or(z.literal("")),
});

export async function submitPropertyDetails(formData: FormData) {
  try {
    const session = await requireSession();
    const parsed = Schema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return;
    const d = parsed.data;

    await advancePropertyDraft(session.agentId, "details", {
      propertyType: d.propertyType || undefined,
      referralSource: d.referralSource || undefined,
      referralSourceOther: d.referralSourceOther || undefined,
      externalReferringAgentName: d.externalReferringAgentName || undefined,
      externalReferringAgentOffice: d.externalReferringAgentOffice || undefined,
      externalReferringAgentPhone: d.externalReferringAgentPhone || undefined,
      referralPercentOfCommission: d.referralPercentOfCommission === "" ? undefined : d.referralPercentOfCommission,
    });
    redirect(propertyStepHref(nextPropertyStep("details")!));
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("submitPropertyDetails failed:", e);
    redirect(propertyStepHref("details") + "?error=save");
  }
}
