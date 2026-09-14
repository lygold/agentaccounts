import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth/session-cookie";
import { loadDraft } from "@/lib/wizard/draft";
import { WizardChrome } from "@/components/wizard-chrome";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { WizardSubmitButton } from "@/components/wizard-submit-button";
import { WIZARD_FORM_ID } from "@/lib/wizard/steps";
import { submitSigningDate } from "./actions";

export default async function SigningDatePage() {
  const session = await requireSession();
  const draft = await loadDraft(session.agentId);
  if (!draft.language) redirect("/deals/new/language");
  if (!draft.dealType) redirect("/deals/new/deal-type");
  const t = await getTranslations("SigningDateStep");

  return (
    <WizardChrome step="signing-date" furthestStep={draft.furthestStep}>
      <form id={WIZARD_FORM_ID} action={submitSigningDate} className="flex flex-col gap-6">
        <p className="text-sm text-muted-foreground">{t("internalNote")}</p>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="signingDate">{t("label")}</Label>
          <Input
            id="signingDate"
            name="signingDate"
            type="date"
            defaultValue={draft.signingDate ?? ""}
            dir="ltr"
            className="text-left"
          />
        </div>
        <WizardSubmitButton />
      </form>
    </WizardChrome>
  );
}
