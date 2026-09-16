import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth/session-cookie";
import { loadPropertyDraft } from "@/lib/property-wizard/draft";
import { PropertyWizardChrome } from "@/components/property-wizard-chrome";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PROPERTY_WIZARD_FORM_ID } from "@/lib/property-wizard/steps";
import { submitPropertyRatings } from "./actions";

/** Office-only internal ratings — never published/exported, see
 *  PropertyRecord's doc comments on these fields. */
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

        <Rating0to9 id="sellabilityRating" label={t("sellabilityLabel")} value={draft.sellabilityRating} />
        <Rating0to9 id="sellerMotivation" label={t("sellerMotivationLabel")} value={draft.sellerMotivation} />
        <Rating0to9 id="priceToCmaMatch" label={t("priceToCmaMatchLabel")} value={draft.priceToCmaMatch} />
        <Rating0to9 id="ownerPressureToSell" label={t("ownerPressureLabel")} value={draft.ownerPressureToSell} />

        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="trueCmaValue">{t("trueCmaValueLabel")}</Label>
            <Input
              id="trueCmaValue"
              name="trueCmaValue"
              type="number"
              inputMode="decimal"
              dir="ltr"
              defaultValue={draft.trueCmaValue?.toString() ?? ""}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="estimatedMonthsToSell">{t("estimatedMonthsLabel")}</Label>
            <Input
              id="estimatedMonthsToSell"
              name="estimatedMonthsToSell"
              type="number"
              inputMode="decimal"
              dir="ltr"
              defaultValue={draft.estimatedMonthsToSell?.toString() ?? ""}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="letterGrade">{t("letterGradeLabel")}</Label>
          <select
            id="letterGrade"
            name="letterGrade"
            defaultValue={draft.letterGrade ?? ""}
            className="h-11 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">{t("selectPlaceholder")}</option>
            {(["A", "B", "C", "D"] as const).map((g) => (
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

function Rating0to9({ id, label, value }: { id: string; label: string; value?: number }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        name={id}
        defaultValue={value?.toString() ?? ""}
        className="h-11 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="" />
        {Array.from({ length: 10 }, (_, i) => i).map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </div>
  );
}
