"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session-cookie";
import { advancePropertyDraft } from "@/lib/property-wizard/draft";
import { propertyStepHref } from "@/lib/property-wizard/steps";
import { isNextJsRedirect } from "@/lib/wizard/action-utils";

const Schema = z.object({
  commissionPercent: z.coerce.number().min(0).max(100).optional().or(z.literal("")),
  vatMode: z.enum(["plus", "included"]),
});

export async function submitPropertyCommission(formData: FormData) {
  try {
    const session = await requireSession();
    const raw = Object.fromEntries(formData.entries());
    const parsed = Schema.safeParse(raw);
    if (!parsed.success) return;

    await advancePropertyDraft(session.agentId, "commission", {
      commissionPercent:
        parsed.data.commissionPercent === "" ? undefined : parsed.data.commissionPercent,
      commissionVatMode: parsed.data.vatMode,
    });
    // TEMPORARY: jumps straight to "review" rather than nextPropertyStep,
    // since steps 5-9 (media/descriptions/technical/ratings) don't exist
    // yet — this batch (1-4) ships a complete, testable deal-type -> submit
    // slice rather than a dead-end 404. Revert to nextPropertyStep("commission")
    // once those steps land.
    redirect(propertyStepHref("review"));
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("submitPropertyCommission failed:", e);
    redirect(propertyStepHref("commission") + "?error=save");
  }
}
