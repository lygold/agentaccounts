"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session-cookie";
import { advancePropertyDraft } from "@/lib/property-wizard/draft";
import { nextPropertyStep, propertyStepHref } from "@/lib/property-wizard/steps";
import { isNextJsRedirect } from "@/lib/wizard/action-utils";

const Schema = z.object({
  city: z.string().trim().min(1),
  street: z.string().trim().min(1),
  buildingNumber: z.string().trim().min(1),
  entrance: z.string().trim().optional(),
  apartmentNumber: z.string().trim().min(1),
  placeId: z.string().trim().optional(),
  formattedAddress: z.string().trim().optional(),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
});

export async function submitPropertyAddress(formData: FormData) {
  try {
    const session = await requireSession();
    const raw = Object.fromEntries(formData.entries());
    const parsed = Schema.safeParse(raw);
    if (!parsed.success) return;

    await advancePropertyDraft(session.agentId, "address", {
      city: parsed.data.city,
      street: parsed.data.street,
      buildingNumber: parsed.data.buildingNumber,
      entrance: parsed.data.entrance || undefined,
      apartmentNumber: parsed.data.apartmentNumber,
      placeId: parsed.data.placeId || undefined,
      formattedAddress: parsed.data.formattedAddress || undefined,
      lat: parsed.data.lat,
      lng: parsed.data.lng,
    });
    redirect(propertyStepHref(nextPropertyStep("address")!));
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("submitPropertyAddress failed:", e);
    redirect(propertyStepHref("address") + "?error=save");
  }
}
