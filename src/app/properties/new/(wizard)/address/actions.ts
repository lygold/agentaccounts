"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session-cookie";
import { saveStepOrReportMissing } from "@/lib/property-wizard/gate";
import { propertyStepHref } from "@/lib/property-wizard/steps";
import { isNextJsRedirect } from "@/lib/wizard/action-utils";

const Schema = z.object({
  city: z.string().trim().optional(),
  neighbourhood: z.string().trim().optional(),
  street: z.string().trim().optional(),
  buildingNumber: z.string().trim().optional(),
  entrance: z.string().trim().optional(),
  apartmentNumber: z.string().trim().optional(),
  publishNotes: z.string().trim().optional(),
  placeId: z.string().trim().optional(),
  formattedAddress: z.string().trim().optional(),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
});

export async function submitPropertyAddress(formData: FormData) {
  try {
    const session = await requireSession();
    const parsed = Schema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) redirect(propertyStepHref("address") + "?error=save");
    const d = parsed.data;

    await saveStepOrReportMissing(session.agentId, "address", {
      city: d.city || undefined,
      neighbourhood: d.neighbourhood || undefined,
      street: d.street || undefined,
      buildingNumber: d.buildingNumber || undefined,
      entrance: d.entrance || undefined,
      apartmentNumber: d.apartmentNumber || undefined,
      publishNotes: d.publishNotes || undefined,
      placeId: d.placeId || undefined,
      formattedAddress: d.formattedAddress || undefined,
      lat: d.lat,
      lng: d.lng,
    });
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("submitPropertyAddress failed:", e);
    redirect(propertyStepHref("address") + "?error=save");
  }
}
