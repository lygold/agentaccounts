import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth/session-cookie";
import { loadDraft } from "@/lib/wizard/draft";
import { WizardChrome } from "@/components/wizard-chrome";
import { ChoiceCards } from "@/components/wizard-choice";
import { submitLanguage } from "./actions";

/**
 * This chooses the PDF document's output language — completely separate
 * from the UI's own rendering language (the corner toggle). Option labels
 * follow the current UI locale (e.g. "Hebrew"/"English" in English UI,
 * "עברית"/"אנגלית" in Hebrew UI), same as the communication-language choice
 * on the owners/buyers steps — only the surrounding prose was already
 * locale-driven before this.
 */
export default async function LanguagePage() {
  const session = await requireSession();
  const draft = await loadDraft(session.agentId);
  const t = await getTranslations("LanguageStep");
  const common = await getTranslations("Common");

  return (
    <WizardChrome step="language" furthestStep={draft.furthestStep} returnToSummaryBehavior="link">
      <div className="flex flex-col gap-6">
        <div className="space-y-3 text-sm leading-relaxed">
          <p>{t("prompt")}</p>
          <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
            <p className="font-semibold">{t("importantTitle")}</p>
            <ul className="mt-1 list-inside list-disc space-y-0.5">
              <li>{t("englishNote")}</li>
              <li>{t("hebrewNote")}</li>
            </ul>
          </div>
        </div>

        <form action={submitLanguage}>
          <ChoiceCards
            name="language"
            selected={draft.language}
            options={[
              { value: "hebrew", label: common("hebrew") },
              { value: "english", label: common("english") },
            ]}
          />
        </form>
      </div>
    </WizardChrome>
  );
}
