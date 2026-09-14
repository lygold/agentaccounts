import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth/session-cookie";
import { loadDraft } from "@/lib/wizard/draft";
import { WizardChrome } from "@/components/wizard-chrome";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { WizardSubmitButton } from "@/components/wizard-submit-button";
import { WIZARD_FORM_ID } from "@/lib/wizard/steps";
import { submitOfficeNotes } from "./actions";

export default async function OfficeNotesPage() {
  const session = await requireSession();
  const draft = await loadDraft(session.agentId);
  if (!draft.language) redirect("/deals/new/language");
  const t = await getTranslations("OfficeNotesStep");

  return (
    <WizardChrome step="office-notes" furthestStep={draft.furthestStep}>
      <form id={WIZARD_FORM_ID} action={submitOfficeNotes} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="officeNotes">{t("label")}</Label>
          <p className="text-xs text-muted-foreground">{t("description")}</p>
          <Textarea
            id="officeNotes"
            name="officeNotes"
            rows={6}
            defaultValue={draft.officeNotes ?? ""}
            placeholder={t("placeholder")}
          />
        </div>
        <WizardSubmitButton />
      </form>
    </WizardChrome>
  );
}
