import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth/session-cookie";
import { loadDraft } from "@/lib/wizard/draft";
import { WizardChrome } from "@/components/wizard-chrome";
import { PartyForm } from "@/components/party-form";
import { submitBuyerLawyer } from "./actions";

export default async function BuyerLawyerPage() {
  const session = await requireSession();
  const draft = await loadDraft(session.agentId);
  if (!draft.language) redirect("/deals/new/language");
  if (!draft.representation) redirect("/deals/new/representation");
  const t = await getTranslations("BuyerLawyerStep");

  const isSale = draft.dealType === "sale";
  const isRental = draft.dealType === "rental";

  return (
    <WizardChrome step="buyer-lawyer" furthestStep={draft.furthestStep}>
      <PartyForm
        action={submitBuyerLawyer}
        initial={draft.buyerLawyer}
        nameRequired={isSale}
        contactRequired={isSale}
        intro={isRental ? t("introRental") : t("intro")}
      />
    </WizardChrome>
  );
}
