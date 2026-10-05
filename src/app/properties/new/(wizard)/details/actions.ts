"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session-cookie";
import { saveStepOrReportMissing } from "@/lib/property-wizard/gate";
import { REFERRAL_EXTERNAL_AGENT, REFERRAL_NONE, REFERRAL_OFFICE_AGENT } from "@/lib/property-wizard/options";
import { propertyStepHref } from "@/lib/property-wizard/steps";
import { isNextJsRedirect } from "@/lib/wizard/action-utils";

const Schema = z.object({
  propertyType: z.string().trim().optional(),
  referralSource: z.string().trim().optional(),
  referralSourceOther: z.string().trim().optional(),
  externalReferringAgentName: z.string().trim().optional(),
  externalReferringAgentOffice: z.string().trim().optional(),
  externalReferringAgentPhone: z.string().trim().optional(),
  referralPercentOfCommission: z.coerce.number().min(0).max(100).optional().or(z.literal("")),
  ownerName: z.string().trim().optional(),
  ownerPhone: z.string().trim().optional(),
  ownerEmail: z.string().trim().optional(),
});

export async function submitPropertyDetails(formData: FormData) {
  try {
    const session = await requireSession();
    const parsed = Schema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) redirect(propertyStepHref("details") + "?error=save");
    const d = parsed.data;

    // Follow-up answers only count for the referral choice that asks them, so a
    // changed choice never leaves stale answers behind.
    const source = d.referralSource || undefined;
    const isExternal = source === REFERRAL_EXTERNAL_AGENT;
    const isReferral = isExternal || source === REFERRAL_OFFICE_AGENT;

    await saveStepOrReportMissing(session.agentId, "details", {
      propertyType: d.propertyType || undefined,
      referralSource: source,
      referralSourceOther: source === REFERRAL_NONE ? d.referralSourceOther || undefined : undefined,
      externalReferringAgentName: isExternal ? d.externalReferringAgentName || undefined : undefined,
      externalReferringAgentOffice: isExternal ? d.externalReferringAgentOffice || undefined : undefined,
      externalReferringAgentPhone: isExternal ? d.externalReferringAgentPhone || undefined : undefined,
      referralPercentOfCommission:
        isReferral && d.referralPercentOfCommission !== "" ? d.referralPercentOfCommission : undefined,
      ownerName: d.ownerName || undefined,
      ownerPhone: d.ownerPhone || undefined,
      ownerEmail: d.ownerEmail || undefined,
    });
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("submitPropertyDetails failed:", e);
    redirect(propertyStepHref("details") + "?error=save");
  }
}
