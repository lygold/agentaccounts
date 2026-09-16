import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth/session-cookie";
import { loadPropertyDraft } from "@/lib/property-wizard/draft";
import { PropertyWizardChrome } from "@/components/property-wizard-chrome";
import { AddressStepForm } from "./address-form";

export default async function PropertyAddressPage() {
  const session = await requireSession();
  const draft = await loadPropertyDraft(session.agentId);
  if (!draft.dealType) redirect("/properties/new/deal-type");
  const t = await getTranslations("PropertyAddressStep");

  return (
    <PropertyWizardChrome step="address" furthestStep={draft.furthestStep} returnToSummaryBehavior="link">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">{t("prompt")}</p>
        <AddressStepForm
          initial={{
            formattedAddress: draft.formattedAddress,
            city: draft.city,
            street: draft.street,
            buildingNumber: draft.buildingNumber,
            entrance: draft.entrance,
            apartmentNumber: draft.apartmentNumber,
            placeId: draft.placeId,
            lat: draft.lat,
            lng: draft.lng,
          }}
        />
      </div>
    </PropertyWizardChrome>
  );
}
