import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth/session-cookie";
import { loadPropertyDraft } from "@/lib/property-wizard/draft";
import { PropertyWizardChrome } from "@/components/property-wizard-chrome";
import { DetailsStepForm } from "./details-form";

export default async function PropertyDetailsPage() {
  const session = await requireSession();
  const draft = await loadPropertyDraft(session.agentId);
  if (!draft.commissionVatMode) redirect("/properties/new/commission");
  const t = await getTranslations("PropertyDetailsStep");

  return (
    <PropertyWizardChrome step="details" furthestStep={draft.furthestStep} returnToSummaryBehavior="link">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">{t("prompt")}</p>
        <DetailsStepForm
          initial={{
            propertyType: draft.propertyType,
            referralSource: draft.referralSource,
            referralSourceOther: draft.referralSourceOther,
            externalReferringAgentName: draft.externalReferringAgentName,
            externalReferringAgentOffice: draft.externalReferringAgentOffice,
            externalReferringAgentPhone: draft.externalReferringAgentPhone,
            referralPercentOfCommission: draft.referralPercentOfCommission,
          }}
        />
      </div>
    </PropertyWizardChrome>
  );
}
