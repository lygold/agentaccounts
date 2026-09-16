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
      exclusivityStartDate: draft.exclusivityStartDate,
      exclusivityEndDate: draft.exclusivityEndDate,
      propertyType: draft.propertyType,
      referralSource: draft.referralSource,
      referralSourceOther: draft.referralSourceOther,
      externalReferringAgentName: draft.externalReferringAgentName,
      externalReferringAgentOffice: draft.externalReferringAgentOffice,
      externalReferringAgentPhone: draft.externalReferringAgentPhone,
      referralPercentOfCommission: draft.referralPercentOfCommission,
      driveFolderId: draft.driveFolderId,
      mainPhotos: draft.mainPhotos,
      additionalPhotos: draft.additionalPhotos,
      forms: draft.forms,
      documents: draft.documents,
      copyrightConfirmed: draft.copyrightConfirmed,
      renderingsConfirmed: draft.renderingsConfirmed,
      virtualTourUrl: draft.virtualTourUrl,
      youtubeUrl: draft.youtubeUrl,
      youtubeDisplayText: draft.youtubeDisplayText,
      titleHe: draft.titleHe,
      titleEn: draft.titleEn,
      useSeparateYad2Description: draft.useSeparateYad2Description,
      descriptionHe: draft.descriptionHe,
      descriptionYad2: draft.descriptionYad2,
      descriptionEn: draft.descriptionEn,
      yad2Package: draft.yad2Package,
      rooms: draft.rooms,
      bedrooms: draft.bedrooms,
      toilets: draft.toilets,
      bathrooms: draft.bathrooms,
      masterSuite: draft.masterSuite,
      floor: draft.floor,
      floorsTotal: draft.floorsTotal,
      levels: draft.levels,
      sizeSqm: draft.sizeSqm,
      plotSizeSqm: draft.plotSizeSqm,
      askingPrice: draft.askingPrice,
      startingPrice: draft.startingPrice,
      condition: draft.condition,
      elevator: draft.elevator,
      balcony: draft.balcony,
      balconySizeSqm: draft.balconySizeSqm,
      garden: draft.garden,
      gardenSizeSqm: draft.gardenSizeSqm,
      ac: draft.ac,
      parking: draft.parking,
      parkingCount: draft.parkingCount,
      storage: draft.storage,
      storageSizeSqm: draft.storageSizeSqm,
      safeRoom: draft.safeRoom,
      additionalFeatures: draft.additionalFeatures,
      sellabilityRating: draft.sellabilityRating,
      sellerMotivation: draft.sellerMotivation,
      priceToCmaMatch: draft.priceToCmaMatch,
      ownerPressureToSell: draft.ownerPressureToSell,
      trueCmaValue: draft.trueCmaValue,
      estimatedMonthsToSell: draft.estimatedMonthsToSell,
      letterGrade: draft.letterGrade,
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
