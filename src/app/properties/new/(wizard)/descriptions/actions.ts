"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session-cookie";
import { advancePropertyDraft } from "@/lib/property-wizard/draft";
import { nextPropertyStep, propertyStepHref } from "@/lib/property-wizard/steps";
import { isNextJsRedirect } from "@/lib/wizard/action-utils";

const Schema = z.object({
  titleHe: z.string().trim().optional(),
  titleEn: z.string().trim().optional(),
  useSeparateYad2Description: z.string().optional(),
  descriptionHe: z.string().trim().optional(),
  descriptionYad2: z.string().trim().optional(),
  descriptionEn: z.string().trim().optional(),
  yad2Package: z.enum(["premium", "ultra", ""]).optional(),
});

export async function submitPropertyDescriptions(formData: FormData) {
  try {
    const session = await requireSession();
    const parsed = Schema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return;
    const d = parsed.data;
    const useSeparateYad2 = d.useSeparateYad2Description === "on";

    await advancePropertyDraft(session.agentId, "descriptions", {
      titleHe: d.titleHe || undefined,
      titleEn: d.titleEn || undefined,
      useSeparateYad2Description: useSeparateYad2,
      descriptionHe: d.descriptionHe || undefined,
      descriptionYad2: useSeparateYad2 ? d.descriptionYad2 || undefined : undefined,
      descriptionEn: d.descriptionEn || undefined,
      yad2Package: d.yad2Package || undefined,
    });
    redirect(propertyStepHref(nextPropertyStep("descriptions")!));
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("submitPropertyDescriptions failed:", e);
    redirect(propertyStepHref("descriptions") + "?error=save");
  }
}
