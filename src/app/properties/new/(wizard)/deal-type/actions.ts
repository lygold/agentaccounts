"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session-cookie";
import { advancePropertyDraft } from "@/lib/property-wizard/draft";
import { nextPropertyStep, propertyStepHref } from "@/lib/property-wizard/steps";
import { isNextJsRedirect } from "@/lib/wizard/action-utils";

const Schema = z.object({
  dealType: z.enum(["sale", "rental"]),
});

export async function submitPropertyDealType(formData: FormData) {
  try {
    const session = await requireSession();
    const parsed = Schema.safeParse({ dealType: formData.get("dealType") });
    if (!parsed.success) return;
    await advancePropertyDraft(session.agentId, "deal-type", {
      dealType: parsed.data.dealType,
    });
    redirect(propertyStepHref(nextPropertyStep("deal-type")!));
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("submitPropertyDealType failed:", e);
    redirect(propertyStepHref("deal-type") + "?error=save");
  }
}
