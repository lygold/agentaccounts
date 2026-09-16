import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth/session-cookie";
import { loadPropertyDraft } from "@/lib/property-wizard/draft";
import { PropertyWizardChrome } from "@/components/property-wizard-chrome";
import { DescriptionsStepForm } from "./descriptions-form";

export default async function PropertyDescriptionsPage() {
  const session = await requireSession();
  const draft = await loadPropertyDraft(session.agentId);
  if (!draft.street) redirect("/properties/new/address");
  const t = await getTranslations("PropertyDescriptionsStep");

  return (
    <PropertyWizardChrome step="descriptions" furthestStep={draft.furthestStep} returnToSummaryBehavior="link">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">{t("prompt")}</p>
        <DescriptionsStepForm
          initial={{
            titleHe: draft.titleHe,
            titleEn: draft.titleEn,
            useSeparateYad2Description: draft.useSeparateYad2Description,
            descriptionHe: draft.descriptionHe,
            descriptionYad2: draft.descriptionYad2,
            descriptionEn: draft.descriptionEn,
            yad2Package: draft.yad2Package,
          }}
        />
      </div>
    </PropertyWizardChrome>
  );
}
