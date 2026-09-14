"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session-cookie";
import { advanceDraft } from "@/lib/wizard/draft";
import { nextStep, stepHref } from "@/lib/wizard/steps";
import { isNextJsRedirect } from "@/lib/wizard/action-utils";

const Schema = z.object({
  language: z.enum(["hebrew", "english"]),
});

export async function submitLanguage(formData: FormData) {
  try {
    const session = await requireSession();
    const parsed = Schema.safeParse({ language: formData.get("language") });
    if (!parsed.success) return;
    await advanceDraft(session.agentId, "language", {
      language: parsed.data.language,
    });
    redirect(stepHref(nextStep("language")!));
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("submitLanguage failed:", e);
    redirect(stepHref("language") + "?error=save");
  }
}
