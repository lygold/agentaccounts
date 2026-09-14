import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth/session-cookie";
import { loadDraft } from "@/lib/wizard/draft";
import { WizardChrome } from "@/components/wizard-chrome";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { WizardSubmitButton } from "@/components/wizard-submit-button";
import { WIZARD_FORM_ID } from "@/lib/wizard/steps";
import { submitNotes } from "./actions";

export default async function NotesPage() {
  const session = await requireSession();
  const draft = await loadDraft(session.agentId);
  if (!draft.language) redirect("/deals/new/language");
  const t = await getTranslations("NotesStep");

  return (
    <WizardChrome step="notes" furthestStep={draft.furthestStep}>
      <form id={WIZARD_FORM_ID} action={submitNotes} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="notes">{t("label")}</Label>
          <Textarea
            id="notes"
            name="notes"
            rows={6}
            defaultValue={draft.notes ?? ""}
            placeholder={t("placeholder")}
          />
        </div>
        <WizardSubmitButton />
      </form>
    </WizardChrome>
  );
}
