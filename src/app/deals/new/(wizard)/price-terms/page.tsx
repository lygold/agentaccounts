import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth/session-cookie";
import { loadDraft } from "@/lib/wizard/draft";
import { WizardChrome } from "@/components/wizard-chrome";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { WizardSubmitButton } from "@/components/wizard-submit-button";
import { WIZARD_FORM_ID } from "@/lib/wizard/steps";
import { submitPriceTerms } from "./actions";

export default async function PriceTermsPage() {
  const session = await requireSession();
  const draft = await loadDraft(session.agentId);
  if (!draft.language) redirect("/deals/new/language");
  if (!draft.dealType) redirect("/deals/new/deal-type");
  if (!draft.representation) redirect("/deals/new/representation");
  if (!draft.property) redirect("/deals/new/property");
  const t = await getTranslations("PriceTermsStep");
  const common = await getTranslations("Common");

  const pt = draft.priceTerms ?? {};

  return (
    <WizardChrome step="price-terms" furthestStep={draft.furthestStep}>
      <form id={WIZARD_FORM_ID} action={submitPriceTerms} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="price">
            {t("priceLabel")} <span className="text-primary">*</span>
          </Label>
          <div className="flex gap-2">
            <select
              name="currency"
              defaultValue={pt.currency ?? "ILS"}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="ILS">₪</option>
              <option value="USD">$</option>
            </select>
            <Input
              id="price"
              name="price"
              type="number"
              inputMode="numeric"
              defaultValue={pt.price?.toString() ?? ""}
              placeholder={t("pricePlaceholder")}
              dir="ltr"
              className="flex-1 text-left"
            />
          </div>
          {pt.price !== undefined && draft.property?.selectedItemId && (
            <p className="text-xs text-muted-foreground">{t("autofillNote")}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="paymentTerms">{t("paymentTermsLabel")}</Label>
          <Textarea
            id="paymentTerms"
            name="paymentTerms"
            rows={3}
            defaultValue={pt.paymentTerms ?? ""}
            placeholder={t("paymentTermsPlaceholder")}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="vacatingDate">{t("vacatingDateLabel")}</Label>
          <Input
            id="vacatingDate"
            name="vacatingDate"
            type="date"
            defaultValue={pt.vacatingDate ?? ""}
            dir="ltr"
            className="text-left"
          />
        </div>

        <WizardSubmitButton />
        <p className="text-xs text-muted-foreground">
          {common("requiredNotePrefix")} <span className="text-primary">*</span>{" "}
          {common("requiredNoteSuffix")}
        </p>
      </form>
    </WizardChrome>
  );
}
