import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth/session-cookie";
import { loadPropertyDraft } from "@/lib/property-wizard/draft";
import { PropertyWizardChrome } from "@/components/property-wizard-chrome";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  LETTER_GRADES,
  RATING_HIGH_CAPTION,
  RATING_LOW_CAPTION,
  RATING_MAX,
} from "@/lib/property-wizard/options";
import { PROPERTY_WIZARD_FORM_ID } from "@/lib/property-wizard/steps";
import { submitPropertyRatings } from "./actions";

const SELECT_CLASS =
  "h-11 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type RatingKey = keyof typeof RATING_LOW_CAPTION;

/** Office-only internal ratings — never published/exported, see
 *  PropertyRecord's doc comments on these fields. All seven answers are
 *  mandatory, as in the original questionnaire. */
export default async function PropertyRatingsPage() {
  const session = await requireSession();
  const draft = await loadPropertyDraft(session.agentId);
  if (!draft.street) redirect("/properties/new/address");
  const t = await getTranslations("PropertyRatingsStep");
  const common = await getTranslations("Common");

  return (
    <PropertyWizardChrome step="ratings" furthestStep={draft.furthestStep} returnToSummaryBehavior="link">
      <form id={PROPERTY_WIZARD_FORM_ID} action={submitPropertyRatings} className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">{t("prompt")}</p>

        <Rating id="sellabilityRating" label={t("sellabilityLabel")} value={draft.sellabilityRating} />
        <Rating id="sellerMotivation" label={t("sellerMotivationLabel")} value={draft.sellerMotivation} />
        <Rating id="priceToCmaMatch" label={t("priceToCmaMatchLabel")} value={draft.priceToCmaMatch} />
        <Rating id="ownerPressureToSell" label={t("ownerPressureLabel")} value={draft.ownerPressureToSell} />

        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="trueCmaValue">
              {t("trueCmaValueLabel")}
              <span className="text-primary"> *</span>
            </Label>
            <Input
              id="trueCmaValue"
              name="trueCmaValue"
              required
              type="number"
              inputMode="decimal"
              dir="ltr"
              defaultValue={draft.trueCmaValue?.toString() ?? ""}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="estimatedMonthsToSell">
              {t("estimatedMonthsLabel")}
              <span className="text-primary"> *</span>
            </Label>
            <Input
              id="estimatedMonthsToSell"
              name="estimatedMonthsToSell"
              required
              type="number"
              inputMode="decimal"
              dir="ltr"
              defaultValue={draft.estimatedMonthsToSell?.toString() ?? ""}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="letterGrade">
            {t("letterGradeLabel")}
            <span className="text-primary"> *</span>
          </Label>
          <select id="letterGrade" name="letterGrade" required defaultValue={draft.letterGrade ?? ""} className={SELECT_CLASS}>
            <option value="">{t("selectPlaceholder")}</option>
            {LETTER_GRADES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>

        <Button type="submit" size="lg">
          {common("continue")}
        </Button>
      </form>
    </PropertyWizardChrome>
  );
}

/** 0-10, with the questionnaire's own captions on the two ends. */
function Rating({ id, label, value }: { id: RatingKey; label: string; value?: number }) {
  const highText = RATING_HIGH_CAPTION[id].replace(/^\d+\s*-\s*/, "");
  const lowText = RATING_LOW_CAPTION[id].replace(/^\d+\s*-\s*/, "");
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {label}
        <span className="text-primary"> *</span>
      </Label>
      <select id={id} name={id} required defaultValue={value?.toString() ?? ""} dir="rtl" className={SELECT_CLASS}>
        <option value="" />
        {Array.from({ length: RATING_MAX + 1 }, (_, i) => i).map((n) => (
          <option key={n} value={n}>
            {n === 0 ? `0 - ${lowText}` : n === RATING_MAX ? `${RATING_MAX} - ${highText}` : n}
          </option>
        ))}
      </select>
    </div>
  );
}
