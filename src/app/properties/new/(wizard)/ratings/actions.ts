"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session-cookie";
import { advancePropertyDraft } from "@/lib/property-wizard/draft";
import { nextPropertyStep, propertyStepHref } from "@/lib/property-wizard/steps";
import { isNextJsRedirect } from "@/lib/wizard/action-utils";

const numOpt = z.coerce.number().optional().or(z.literal(""));

const Schema = z.object({
  sellabilityRating: numOpt,
  sellerMotivation: numOpt,
  priceToCmaMatch: numOpt,
  ownerPressureToSell: numOpt,
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
    if (!parsed.success) return;
    const d = parsed.data;

    await advancePropertyDraft(session.agentId, "ratings", {
      sellabilityRating: n(d.sellabilityRating),
      sellerMotivation: n(d.sellerMotivation),
      priceToCmaMatch: n(d.priceToCmaMatch),
      ownerPressureToSell: n(d.ownerPressureToSell),
      trueCmaValue: n(d.trueCmaValue),
      estimatedMonthsToSell: n(d.estimatedMonthsToSell),
      letterGrade: d.letterGrade || undefined,
    });
    redirect(propertyStepHref(nextPropertyStep("ratings")!));
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("submitPropertyRatings failed:", e);
    redirect(propertyStepHref("ratings") + "?error=save");
  }
}
