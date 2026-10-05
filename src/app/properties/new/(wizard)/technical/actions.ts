"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session-cookie";
import { saveStepOrReportMissing } from "@/lib/property-wizard/gate";
import { ADDITIONAL_FEATURES } from "@/lib/property-wizard/options";
import { propertyStepHref } from "@/lib/property-wizard/steps";
import { isNextJsRedirect } from "@/lib/wizard/action-utils";

const numOpt = z.coerce.number().optional().or(z.literal(""));
const str = z.string().trim().optional();

const Schema = z.object({
  rooms: numOpt,
  bedrooms: numOpt,
  toilets: numOpt,
  bathrooms: numOpt,
  masterSuite: str,
  floor: numOpt,
  floorsTotal: numOpt,
  levels: str,
  sizeSqm: numOpt,
  plotSizeSqm: numOpt,
  askingPrice: numOpt,
  condition: str,
  elevator: str,
  ac: str,
  safeRoom: str,
  balcony: str,
  balconySizeSqm: numOpt,
  garden: str,
  gardenSizeSqm: numOpt,
  parking: str,
  parkingCount: numOpt,
  storage: str,
  storageSizeSqm: numOpt,
});

function n(v: number | "" | undefined): number | undefined {
  return v === "" || v === undefined ? undefined : v;
}

export async function submitPropertyTechnical(formData: FormData) {
  try {
    const session = await requireSession();
    const parsed = Schema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) redirect(propertyStepHref("technical") + "?error=save");
    const d = parsed.data;

    // Multi-select: only labels the board actually has.
    const allowed = new Set<string>(ADDITIONAL_FEATURES);
    const features = formData.getAll("additionalFeatures").map(String).filter((f) => allowed.has(f));

    await saveStepOrReportMissing(session.agentId, "technical", {
      rooms: n(d.rooms),
      bedrooms: n(d.bedrooms),
      toilets: n(d.toilets),
      bathrooms: n(d.bathrooms),
      masterSuite: d.masterSuite || undefined,
      floor: n(d.floor),
      floorsTotal: n(d.floorsTotal),
      levels: d.levels || undefined,
      sizeSqm: n(d.sizeSqm),
      plotSizeSqm: n(d.plotSizeSqm),
      askingPrice: n(d.askingPrice),
      condition: d.condition || undefined,
      elevator: d.elevator || undefined,
      ac: d.ac || undefined,
      safeRoom: d.safeRoom || undefined,
      balcony: d.balcony || undefined,
      balconySizeSqm: n(d.balconySizeSqm),
      garden: d.garden || undefined,
      gardenSizeSqm: n(d.gardenSizeSqm),
      parking: d.parking || undefined,
      parkingCount: n(d.parkingCount),
      storage: d.storage || undefined,
      storageSizeSqm: n(d.storageSizeSqm),
      additionalFeatures: features.length > 0 ? features : undefined,
    });
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("submitPropertyTechnical failed:", e);
    redirect(propertyStepHref("technical") + "?error=save");
  }
}
