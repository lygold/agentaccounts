"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session-cookie";
import { advancePropertyDraft } from "@/lib/property-wizard/draft";
import { nextPropertyStep, propertyStepHref } from "@/lib/property-wizard/steps";
import { isNextJsRedirect } from "@/lib/wizard/action-utils";

const Schema = z.object({
  commissionPercent: z.coerce.number().min(0).max(100).optional().or(z.literal("")),
  vatMode: z.enum(["plus", "included"]),
  exclusivityStartDate: z.string().trim().optional(),
  exclusivityEndDate: z.string().trim().optional(),
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
      exclusivityStartDate: parsed.data.exclusivityStartDate || undefined,
      exclusivityEndDate: parsed.data.exclusivityEndDate || undefined,
    });
    redirect(propertyStepHref(nextPropertyStep("commission")!));
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("submitPropertyCommission failed:", e);
    redirect(propertyStepHref("commission") + "?error=save");
  }
}
