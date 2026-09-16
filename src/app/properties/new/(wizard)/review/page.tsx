import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth/session-cookie";
import { loadPropertyDraft } from "@/lib/property-wizard/draft";
import { PropertyWizardChrome } from "@/components/property-wizard-chrome";
import { Button } from "@/components/ui/button";
import { propertyStepHref, PROPERTY_WIZARD_FORM_ID } from "@/lib/property-wizard/steps";
import Link from "next/link";
import { submitPropertyReview } from "./actions";

/** Minimal review for batch 1 (steps 1-4: deal-type/contract-pick/address/
 *  commission) — will grow a section per step as 5-9 land. Submits
 *  whatever the draft has so far into a real PropertyRecord. */
export default async function PropertyReviewPage() {
  const session = await requireSession();
  const draft = await loadPropertyDraft(session.agentId);
  if (!draft.street) redirect("/properties/new/address");
  const t = await getTranslations("PropertyReviewStep");
  const common = await getTranslations("Common");

  return (
    <PropertyWizardChrome step="review" furthestStep={draft.furthestStep}>
      <div className="flex flex-col gap-4">
        <Section title={t("dealTypeTitle")} editHref={propertyStepHref("deal-type")}>
          {draft.dealType === "rental" ? t("rental") : t("sale")}
        </Section>
        <Section title={t("addressTitle")} editHref={propertyStepHref("address")}>
          {draft.formattedAddress || `${draft.street} ${draft.buildingNumber}`}
        </Section>
        {draft.ownerName && (
          <Section title={t("ownerTitle")} editHref={propertyStepHref("contract-pick")}>
            {draft.ownerName}
            {draft.ownerPhone ? ` · ${draft.ownerPhone}` : ""}
          </Section>
        )}
        <Section title={t("commissionTitle")} editHref={propertyStepHref("commission")}>
          {draft.commissionPercent != null
            ? `${draft.commissionPercent}% (${draft.commissionVatMode === "included" ? t("vatIncluded") : t("vatPlus")})`
            : t("notSet")}
        </Section>
        {draft.propertyType && (
          <Section title={t("propertyTypeTitle")} editHref={propertyStepHref("details")}>
            {draft.propertyType}
          </Section>
        )}
        <Section title={t("mediaTitle")} editHref={propertyStepHref("media")}>
          {t("mediaCount", {
            main: draft.mainPhotos?.length ?? 0,
            additional: draft.additionalPhotos?.length ?? 0,
          })}
        </Section>
        {(draft.sizeSqm || draft.rooms || draft.askingPrice) && (
          <Section title={t("technicalTitle")} editHref={propertyStepHref("technical")}>
            {[
              draft.rooms ? t("roomsShort", { n: draft.rooms }) : null,
              draft.sizeSqm ? t("sizeSqmShort", { n: draft.sizeSqm }) : null,
              draft.askingPrice ? t("priceShort", { n: draft.askingPrice }) : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </Section>
        )}

        <form id={PROPERTY_WIZARD_FORM_ID} action={submitPropertyReview}>
          <Button type="submit" size="lg" className="w-full">
            {t("submit")}
          </Button>
        </form>
        <p className="text-xs text-muted-foreground">{t("moreStepsNote")}</p>
      </div>
    </PropertyWizardChrome>
  );
}

function Section({
  title,
  editHref,
  children,
}: {
  title: string;
  editHref: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border p-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-muted-foreground">{title}</span>
        <span className="text-sm font-medium">{children}</span>
      </div>
      <Link href={editHref} className="shrink-0 text-xs text-secondary underline-offset-4 hover:underline">
        {/* Reuses Common's edit-ish concept minimally — just a link, no icon. */}
        ✎
      </Link>
    </div>
  );
}
