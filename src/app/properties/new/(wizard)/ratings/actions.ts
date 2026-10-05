"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session-cookie";
import { saveStepOrReportMissing } from "@/lib/property-wizard/gate";
import { propertyStepHref } from "@/lib/property-wizard/steps";
import { isNextJsRedirect } from "@/lib/wizard/action-utils";

const rating = z.coerce.number().int().min(0).max(10).optional().or(z.literal(""));
const numOpt = z.coerce.number().optional().or(z.literal(""));

const Schema = z.object({
  sellabilityRating: rating,
  sellerMotivation: rating,
  priceToCmaMatch: rating,
  ownerPressureToSell: rating,
  trueCmaValue: numOpt,
  estimatedMonthsToSell: numOpt,
  letterGrade: z.enum(["A", "B", "C", "D", ""]).optional(),
});

function n(v: number | "" | undefined): number | undefined {
  return v === "" || v === undefined ? undefined : v;
}

export async function submitPropertyRatings(formData: FormData) {
  try {
    const session = await requireSession();
    const parsed = Schema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) redirect(propertyStepHref("ratings") + "?error=save");
    const d = parsed.data;

    await saveStepOrReportMissing(session.agentId, "ratings", {
      sellabilityRating: n(d.sellabilityRating),
      sellerMotivation: n(d.sellerMotivation),
      priceToCmaMatch: n(d.priceToCmaMatch),
      ownerPressureToSell: n(d.ownerPressureToSell),
      trueCmaValue: n(d.trueCmaValue),
      estimatedMonthsToSell: n(d.estimatedMonthsToSell),
      letterGrade: d.letterGrade || undefined,
    });
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("submitPropertyRatings failed:", e);
    redirect(propertyStepHref("ratings") + "?error=save");
  }
}
