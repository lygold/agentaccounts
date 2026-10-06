import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth/session-cookie";
import { loadPropertyDraft } from "@/lib/property-wizard/draft";
import { parseStreetAndBuilding } from "@/lib/property-wizard/address-parse";
import { verifyAddressText, type AddressVerification } from "@/lib/places";
import { PropertyWizardChrome } from "@/components/property-wizard-chrome";
import { AddressStepForm } from "./address-form";

export default async function PropertyAddressPage() {
  const session = await requireSession();
  const draft = await loadPropertyDraft(session.agentId);
  if (!draft.dealType) redirect("/properties/new/deal-type");
  const t = await getTranslations("PropertyAddressStep");

  let initial = {
    formattedAddress: draft.formattedAddress,
    city: draft.city,
    neighbourhood: draft.neighbourhood,
    publishNotes: draft.publishNotes,
    street: draft.street,
    buildingNumber: draft.buildingNumber,
    entrance: draft.entrance,
    apartmentNumber: draft.apartmentNumber,
    placeId: draft.placeId,
    lat: draft.lat,
    lng: draft.lng,
    addressManualOverride: draft.addressManualOverride,
  };

  // An address that is not yet Google-confirmed - typically the text auto-filled
  // from a signed contract - is checked against Google here, so the agent sees
  // Google's spelling/city to confirm instead of the contract's raw text.
  let verification: AddressVerification | undefined;
  const text = draft.formattedAddress || [draft.street, draft.buildingNumber].filter(Boolean).join(" ");
  if (!draft.placeId && !draft.addressManualOverride && draft.street && text) {
    const parsed = draft.formattedAddress ? parseStreetAndBuilding(draft.formattedAddress) : {};
    const result = await verifyAddressText(text, {
      street: draft.street ?? parsed.street,
      buildingNumber: draft.buildingNumber ?? parsed.buildingNumber,
      city: draft.city,
    });
    if (result.status === "verified" && result.details) {
      const d = result.details;
      initial = {
        ...initial,
        city: d.city ?? initial.city,
        neighbourhood: d.neighbourhood ?? initial.neighbourhood,
        street: d.street ?? initial.street,
        buildingNumber: d.buildingNumber ?? initial.buildingNumber,
        placeId: d.placeId,
        formattedAddress: d.formattedAddress,
        lat: d.lat ?? undefined,
        lng: d.lng ?? undefined,
      };
    } else {
      verification = result;
    }
  }

  return (
    <PropertyWizardChrome step="address" furthestStep={draft.furthestStep} returnToSummaryBehavior="link">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">{t("prompt")}</p>
        <AddressStepForm initial={initial} verification={verification} />
      </div>
    </PropertyWizardChrome>
  );
}
