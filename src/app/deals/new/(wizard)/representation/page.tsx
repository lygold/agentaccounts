import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth/session-cookie";
import { loadDraft, type DealType } from "@/lib/wizard/draft";
import { WizardChrome } from "@/components/wizard-chrome";
import { ChoiceCards } from "@/components/wizard-choice";
import { submitRepresentation } from "./actions";

export default async function RepresentationPage() {
  const session = await requireSession();
  const draft = await loadDraft(session.agentId);
  if (!draft.language) redirect("/deals/new/language");
  if (!draft.dealType) redirect("/deals/new/deal-type");

  const t = await getTranslations("RepresentationStep");
  const sides = await getTranslations("Sides");
  const isRental = draft.dealType === ("rental" satisfies DealType);
  const ownerLabel = isRental ? sides("ownerRental") : sides("ownerSale");
  const buyerLabel = isRental ? sides("buyerRental") : sides("buyerSale");

  return (
    <WizardChrome step="representation" furthestStep={draft.furthestStep} returnToSummaryBehavior="link">
      <div className="flex flex-col gap-6">
        <p className="text-sm text-muted-foreground">{t("prompt")}</p>
        <form action={submitRepresentation}>
          <ChoiceCards
            name="representation"
            selected={draft.representation}
            options={[
              { value: "owner", label: ownerLabel },
              { value: "buyer", label: buyerLabel },
              { value: "both", label: t("both"), hint: t("bothHint") },
            ]}
          />
        </form>
      </div>
    </WizardChrome>
  );
}
