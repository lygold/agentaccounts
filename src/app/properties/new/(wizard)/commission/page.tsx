import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth/session-cookie";
import { loadPropertyDraft } from "@/lib/property-wizard/draft";
import { PropertyWizardChrome } from "@/components/property-wizard-chrome";
import { CommissionStepForm } from "./commission-form";

export default async function PropertyCommissionPage() {
  const session = await requireSession();
  const draft = await loadPropertyDraft(session.agentId);
  if (!draft.street) redirect("/properties/new/address");
  const t = await getTranslations("PropertyCommissionStep");

  return (
    <PropertyWizardChrome step="commission" furthestStep={draft.furthestStep} returnToSummaryBehavior="link">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">{t("prompt")}</p>
        <CommissionStepForm
          initialPercent={draft.commissionPercent}
          initialVatMode={draft.commissionVatMode}
          initialExclusivityStartDate={draft.exclusivityStartDate}
          initialExclusivityEndDate={draft.exclusivityEndDate}
        />
      </div>
    </PropertyWizardChrome>
  );
}
