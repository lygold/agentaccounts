"use server";

import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session-cookie";
import { loadPropertyDraft, savePropertyDraft, emptyPropertyDraft } from "@/lib/property-wizard/draft";
import { createProperty } from "@/lib/store/properties";
import { propertyStepHref } from "@/lib/property-wizard/steps";
import { isNextJsRedirect } from "@/lib/wizard/action-utils";

export async function submitPropertyReview() {
  try {
    const session = await requireSession();
    const draft = await loadPropertyDraft(session.agentId);
    if (!draft.dealType || !draft.street || !draft.buildingNumber) {
      redirect(propertyStepHref("address"));
    }

    const property = await createProperty({
      officeId: session.officeId,
      agentId: session.agentId,
      agentName: session.agentName,
      dealType: draft.dealType!,
      sourceContractMondayId: draft.sourceContractMondayId,
      sourceContractRole: draft.sourceContractRole,
      city: draft.city,
      street: draft.street,
      buildingNumber: draft.buildingNumber,
      entrance: draft.entrance,
      apartmentNumber: draft.apartmentNumber,
      placeId: draft.placeId,
      formattedAddress: draft.formattedAddress,
      lat: draft.lat,
      lng: draft.lng,
      ownerName: draft.ownerName,
      ownerPhone: draft.ownerPhone,
      ownerEmail: draft.ownerEmail,
      commissionPercent: draft.commissionPercent,
      commissionVatMode: draft.commissionVatMode,
    });

    // Clear the draft so a fresh /properties/new starts clean, but keep the
    // furthestStep pointer meaningless here — reset entirely rather than
    // leaving stale steps-1-4 data an agent could accidentally resubmit.
    await savePropertyDraft(session.agentId, emptyPropertyDraft());

    redirect(`/properties/new/done?id=${property.id}`);
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("submitPropertyReview failed:", e);
    redirect(propertyStepHref("review") + "?error=save");
  }
}
