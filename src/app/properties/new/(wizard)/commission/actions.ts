"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session-cookie";
import { saveStepOrReportMissing } from "@/lib/property-wizard/gate";
import { propertyStepHref } from "@/lib/property-wizard/steps";
import { isNextJsRedirect } from "@/lib/wizard/action-utils";

const Schema = z.object({
  commissionPercent: z.coerce.number().min(0).max(100).optional().or(z.literal("")),
  vatMode: z.enum(["plus", "included", ""]).optional(),
  exclusivityStartDate: z.string().trim().optional(),
  exclusivityEndDate: z.string().trim().optional(),
});

export async function submitPropertyCommission(formData: FormData) {
  try {
    const session = await requireSession();
    const parsed = Schema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) redirect(propertyStepHref("commission") + "?error=save");
    const d = parsed.data;

    await saveStepOrReportMissing(session.agentId, "commission", {
      commissionPercent: d.commissionPercent === "" ? undefined : d.commissionPercent,
      commissionVatMode: d.vatMode || undefined,
      exclusivityStartDate: d.exclusivityStartDate || undefined,
      exclusivityEndDate: d.exclusivityEndDate || undefined,
    });
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("submitPropertyCommission failed:", e);
    redirect(propertyStepHref("commission") + "?error=save");
  }
}
