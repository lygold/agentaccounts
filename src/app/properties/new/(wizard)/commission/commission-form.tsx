"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PROPERTY_WIZARD_FORM_ID } from "@/lib/property-wizard/steps";
import type { VatMode } from "@/lib/wizard/draft";
import { submitPropertyCommission } from "./actions";

export function CommissionStepForm({
  initialPercent,
  initialVatMode,
}: {
  initialPercent?: number;
  initialVatMode?: VatMode;
}) {
  const t = useTranslations("PropertyCommissionStep");
  const common = useTranslations("Common");
  const [vatMode, setVatMode] = useState<VatMode>(initialVatMode ?? "plus");

  return (
    <form id={PROPERTY_WIZARD_FORM_ID} action={submitPropertyCommission} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="commissionPercent">{t("percentLabel")}</Label>
        <Input
          id="commissionPercent"
          name="commissionPercent"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          max="100"
          defaultValue={initialPercent?.toString() ?? ""}
          dir="ltr"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>{t("vatModeLabel")}</Label>
        <div className="flex gap-2">
          {(["plus", "included"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVatMode(v)}
              className={[
                "flex-1 rounded-md border-2 px-3 py-2 text-sm transition-colors",
                vatMode === v ? "border-primary bg-primary/5" : "border-input",
              ].join(" ")}
            >
              {v === "plus" ? t("vatPlus") : t("vatIncluded")}
            </button>
          ))}
        </div>
        <input type="hidden" name="vatMode" value={vatMode} />
      </div>

      <Button type="submit" size="lg">
        {common("continue")}
      </Button>
    </form>
  );
}
