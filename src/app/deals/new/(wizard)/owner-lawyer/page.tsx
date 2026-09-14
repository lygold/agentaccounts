import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth/session-cookie";
import { loadDraft } from "@/lib/wizard/draft";
import { WizardChrome } from "@/components/wizard-chrome";
import { PartyForm } from "@/components/party-form";
import { submitOwnerLawyer } from "./actions";

export default async function OwnerLawyerPage() {
  const session = await requireSession();
  const draft = await loadDraft(session.agentId);
  if (!draft.language) redirect("/deals/new/language");
  if (!draft.representation) redirect("/deals/new/representation");
  const t = await getTranslations("OwnerLawyerStep");

  // Lawyer is required-for-PDF on Sale regardless of who we represent
  // (matches the corrected Sale-template rules); on Rental, lawyers are
  // advisory only (matches the corrected Rental rules — Make scenario
  // omitted lawyer checks for rentals entirely).
  const isSale = draft.dealType === "sale";

  return (
    <WizardChrome step="owner-lawyer" furthestStep={draft.furthestStep}>
      <PartyForm
        action={submitOwnerLawyer}
        initial={draft.ownerLawyer}
        nameRequired={isSale}
        contactRequired={isSale}
        intro={t("intro")}
      />
    </WizardChrome>
  );
}
