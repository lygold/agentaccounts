"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session-cookie";
import { saveStepOrReportMissing } from "@/lib/property-wizard/gate";
import { propertyStepHref } from "@/lib/property-wizard/steps";
import { parseYesNo } from "@/lib/yes-no";
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
    if (!parsed.success) redirect(propertyStepHref("descriptions") + "?error=save");
    const d = parsed.data;
    const separate = parseYesNo(d.useSeparateYad2Description);

    await saveStepOrReportMissing(session.agentId, "descriptions", {
      titleHe: d.titleHe || undefined,
      titleEn: d.titleEn || undefined,
      useSeparateYad2Description: separate,
      descriptionHe: d.descriptionHe || undefined,
      descriptionYad2: separate ? d.descriptionYad2 || undefined : undefined,
      descriptionEn: d.descriptionEn || undefined,
      yad2Package: d.yad2Package || undefined,
    });
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("submitPropertyDescriptions failed:", e);
    redirect(propertyStepHref("descriptions") + "?error=save");
  }
}
