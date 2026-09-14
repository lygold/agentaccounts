"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session-cookie";
import { advanceDraft } from "@/lib/wizard/draft";
import { nextStep, stepHref } from "@/lib/wizard/steps";
import { isNextJsRedirect } from "@/lib/wizard/action-utils";

const Schema = z.object({
  otherSideRepresentedBy: z.enum(["colleague", "external"]),
});

export async function submitOtherSide(formData: FormData) {
  try {
    const session = await requireSession();
    const parsed = Schema.safeParse({
      otherSideRepresentedBy: formData.get("otherSideRepresentedBy"),
    });
    if (!parsed.success) return;
    await advanceDraft(session.agentId, "other-side", {
      otherSideRepresentedBy: parsed.data.otherSideRepresentedBy,
    });
    redirect(stepHref(nextStep("other-side")!));
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("submitOtherSide failed:", e);
    redirect(stepHref("other-side") + "?error=save");
  }
}
