import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth/session-cookie";
import { loadPropertyDraft } from "@/lib/property-wizard/draft";
import { PropertyWizardChrome } from "@/components/property-wizard-chrome";
import { Button } from "@/components/ui/button";
import { propertyStepHref, PROPERTY_WIZARD_FORM_ID } from "@/lib/property-wizard/steps";
import { missingAll } from "@/lib/property-wizard/required";
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
  const tMissing = await getTranslations("PropertyMissing");
  const missing = missingAll(draft);

  return (
    <PropertyWizardChrome step="review" furthestStep={draft.furthestStep}>
      <div className="flex flex-col gap-4">
        {missing.length > 0 && (
          <div className="flex flex-col gap-2 rounded-md border border-destructive/50 bg-destructive/5 p-3" role="alert">
            <p className="text-sm font-medium">{tMissing("reviewTitle")}</p>
            <ul className="flex flex-col gap-1 text-sm">
              {missing.map((m) => (
                <li key={m.key}>
                  <Link href={propertyStepHref(m.step)} className="text-secondary underline-offset-4 hover:underline">
                    {tMissing.has(m.key) ? tMissing(m.key) : m.key}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        <Section title={t("dealTypeTitle")} editHref={propertyStepHref("deal-type")}>
          {draft.dealType === "rental" ? t("rental") : t("sale")}
          {draft.contractType &&
            ` · ${draft.contractType === "biladiut" ? t("contractTypeBiladiut") : t("contractTypeHaskama")}`}
        </Section>
        <Section title={t("addressTitle")} editHref={propertyStepHref("address")}>
          {draft.formattedAddress || `${draft.street} ${draft.buildingNumber}`}
        </Section>
        {draft.ownerName && (
          <Section title={t("ownerTitle")} editHref={propertyStepHref("details")}>
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
            main: draft.media?.mainPhotos?.length ?? 0,
            additional: draft.media?.additionalPhotos?.length ?? 0,
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
          <Button type="submit" size="lg" className="w-full" disabled={missing.length > 0}>
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
