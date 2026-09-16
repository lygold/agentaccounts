import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth/session-cookie";
import { loadPropertyDraft } from "@/lib/property-wizard/draft";
import { PropertyWizardChrome } from "@/components/property-wizard-chrome";
import { ChoiceCards } from "@/components/wizard-choice";
import { submitPropertyDealType } from "./actions";

export default async function PropertyDealTypePage() {
  const session = await requireSession();
  const draft = await loadPropertyDraft(session.agentId);
  const t = await getTranslations("PropertyDealTypeStep");

  return (
    <PropertyWizardChrome step="deal-type" furthestStep={draft.furthestStep} returnToSummaryBehavior="link">
      <div className="flex flex-col gap-6">
        <p className="text-sm text-muted-foreground">{t("prompt")}</p>
        <form action={submitPropertyDealType}>
          <ChoiceCards
            name="dealType"
            selected={draft.dealType}
            options={[
              { value: "sale", label: t("sale"), hint: t("saleHint") },
              { value: "rental", label: t("rental"), hint: t("rentalHint") },
            ]}
          />
        </form>
      </div>
    </PropertyWizardChrome>
  );
}
