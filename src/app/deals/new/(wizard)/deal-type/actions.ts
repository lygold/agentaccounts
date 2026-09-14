"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session-cookie";
import { advanceDraft } from "@/lib/wizard/draft";
import { nextStep, stepHref } from "@/lib/wizard/steps";
import { isNextJsRedirect } from "@/lib/wizard/action-utils";

const Schema = z.object({
  dealType: z.enum(["sale", "rental"]),
});

export async function submitDealType(formData: FormData) {
  try {
    const session = await requireSession();
    const parsed = Schema.safeParse({ dealType: formData.get("dealType") });
    if (!parsed.success) return;
    await advanceDraft(session.agentId, "deal-type", {
      dealType: parsed.data.dealType,
    });
    redirect(stepHref(nextStep("deal-type")!));
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("submitDealType failed:", e);
    redirect(stepHref("deal-type") + "?error=save");
  }
}
