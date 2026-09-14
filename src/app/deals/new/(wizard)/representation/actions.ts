"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session-cookie";
import { advanceDraft } from "@/lib/wizard/draft";
import { nextStep, stepHref } from "@/lib/wizard/steps";
import { isNextJsRedirect } from "@/lib/wizard/action-utils";

const Schema = z.object({
  representation: z.enum(["owner", "buyer", "both"]),
});

export async function submitRepresentation(formData: FormData) {
  try {
    const session = await requireSession();
    const parsed = Schema.safeParse({
      representation: formData.get("representation"),
    });
    if (!parsed.success) return;
    await advanceDraft(session.agentId, "representation", {
      representation: parsed.data.representation,
    });
    redirect(stepHref(nextStep("representation")!));
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("submitRepresentation failed:", e);
    redirect(stepHref("representation") + "?error=save");
  }
}
