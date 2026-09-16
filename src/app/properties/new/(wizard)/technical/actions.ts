"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session-cookie";
import { advancePropertyDraft } from "@/lib/property-wizard/draft";
import { nextPropertyStep, propertyStepHref } from "@/lib/property-wizard/steps";
import { isNextJsRedirect } from "@/lib/wizard/action-utils";

const numOpt = z.coerce.number().optional().or(z.literal(""));

const Schema = z.object({
  rooms: numOpt,
  bedrooms: numOpt,
  toilets: numOpt,
  bathrooms: numOpt,
  floor: numOpt,
  floorsTotal: numOpt,
  levels: z.string().trim().optional(),
  sizeSqm: numOpt,
  plotSizeSqm: numOpt,
  askingPrice: numOpt,
  startingPrice: numOpt,
  condition: z.string().trim().optional(),
  elevator: z.string().optional(),
  ac: z.string().optional(),
  safeRoom: z.string().optional(),
  balcony: z.string().optional(),
  balconySizeSqm: numOpt,
  garden: z.string().optional(),
  gardenSizeSqm: numOpt,
  parking: z.string().optional(),
  parkingCount: numOpt,
  storage: z.string().optional(),
  storageSizeSqm: numOpt,
  additionalFeatures: z.string().trim().optional(),
});

function n(v: number | "" | undefined): number | undefined {
  return v === "" || v === undefined ? undefined : v;
}
function b(v: string | undefined): boolean {
  return v === "on";
}

export async function submitPropertyTechnical(formData: FormData) {
  try {
    const session = await requireSession();
    const parsed = Schema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return;
    const d = parsed.data;

    await advancePropertyDraft(session.agentId, "technical", {
      rooms: n(d.rooms),
      bedrooms: n(d.bedrooms),
      toilets: n(d.toilets),
      bathrooms: n(d.bathrooms),
      floor: n(d.floor),
      floorsTotal: n(d.floorsTotal),
      levels: d.levels || undefined,
      sizeSqm: n(d.sizeSqm),
      plotSizeSqm: n(d.plotSizeSqm),
      askingPrice: n(d.askingPrice),
      startingPrice: n(d.startingPrice),
      condition: d.condition || undefined,
      elevator: b(d.elevator),
      ac: b(d.ac),
      safeRoom: b(d.safeRoom),
      balcony: b(d.balcony),
      balconySizeSqm: n(d.balconySizeSqm),
      garden: b(d.garden),
      gardenSizeSqm: n(d.gardenSizeSqm),
      parking: b(d.parking),
      parkingCount: n(d.parkingCount),
      storage: b(d.storage),
      storageSizeSqm: n(d.storageSizeSqm),
      additionalFeatures: d.additionalFeatures
        ? d.additionalFeatures.split(",").map((s) => s.trim()).filter(Boolean)
        : undefined,
    });
    redirect(propertyStepHref(nextPropertyStep("technical")!));
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("submitPropertyTechnical failed:", e);
    redirect(propertyStepHref("technical") + "?error=save");
  }
}
