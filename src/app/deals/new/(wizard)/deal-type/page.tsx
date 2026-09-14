import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth/session-cookie";
import { loadDraft } from "@/lib/wizard/draft";
import { WizardChrome } from "@/components/wizard-chrome";
import { ChoiceCards } from "@/components/wizard-choice";
import { submitDealType } from "./actions";

export default async function DealTypePage() {
  const session = await requireSession();
  const draft = await loadDraft(session.agentId);
  if (!draft.language) redirect("/deals/new/language");
  const t = await getTranslations("DealTypeStep");

  return (
    <WizardChrome step="deal-type" furthestStep={draft.furthestStep} returnToSummaryBehavior="link">
      <div className="flex flex-col gap-6">
        <p className="text-sm text-muted-foreground">{t("prompt")}</p>
        <form action={submitDealType}>
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
    </WizardChrome>
  );
}
