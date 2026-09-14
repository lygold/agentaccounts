import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth/session-cookie";
import { loadDraft, type DealType } from "@/lib/wizard/draft";
import { WizardChrome } from "@/components/wizard-chrome";
import { ChoiceCards } from "@/components/wizard-choice";
import { nextStep, stepHref } from "@/lib/wizard/steps";
import { submitOtherSide } from "./actions";

export default async function OtherSidePage() {
  const session = await requireSession();
  const draft = await loadDraft(session.agentId);
  if (!draft.language) redirect("/deals/new/language");
  if (!draft.dealType) redirect("/deals/new/deal-type");
  if (!draft.representation) redirect("/deals/new/representation");

  // Only relevant when this agent represents just one side — "both" already
  // covers both sides, so skip straight past this step.
  if (draft.representation === "both") {
    redirect(stepHref(nextStep("other-side")!));
  }

  const t = await getTranslations("OtherSideStep");
  const sides = await getTranslations("Sides");
  const isRental = draft.dealType === ("rental" satisfies DealType);
  const ownerLabel = isRental ? sides("ownerRental") : sides("ownerSale");
  const buyerLabel = isRental ? sides("buyerRental") : sides("buyerSale");
  const otherSideLabel = draft.representation === "owner" ? buyerLabel : ownerLabel;

  return (
    <WizardChrome
      step="other-side"
      furthestStep={draft.furthestStep}
      returnToSummaryBehavior="link"
    >
      <div className="flex flex-col gap-6">
        <p className="text-sm text-muted-foreground">
          {t("prompt", { label: otherSideLabel })}
        </p>
        <form action={submitOtherSide}>
          <ChoiceCards
            name="otherSideRepresentedBy"
            selected={draft.otherSideRepresentedBy}
            options={[
              { value: "colleague", label: t("colleague") },
              { value: "external", label: t("external") },
            ]}
          />
        </form>
      </div>
    </WizardChrome>
  );
}
