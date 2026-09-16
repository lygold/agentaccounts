"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { PROPERTY_WIZARD_FORM_ID } from "@/lib/property-wizard/steps";
import { submitPropertyDescriptions } from "./actions";

interface Initial {
  titleHe?: string;
  titleEn?: string;
  useSeparateYad2Description?: boolean;
  descriptionHe?: string;
  descriptionYad2?: string;
  descriptionEn?: string;
  yad2Package?: string;
}

export function DescriptionsStepForm({ initial }: { initial: Initial }) {
  const t = useTranslations("PropertyDescriptionsStep");
  const common = useTranslations("Common");
  const [separateYad2, setSeparateYad2] = useState(initial.useSeparateYad2Description ?? false);

  return (
    <form id={PROPERTY_WIZARD_FORM_ID} action={submitPropertyDescriptions} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="titleHe">{t("titleHeLabel")}</Label>
        <Input id="titleHe" name="titleHe" dir="rtl" defaultValue={initial.titleHe ?? ""} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="titleEn">{t("titleEnLabel")}</Label>
        <Input id="titleEn" name="titleEn" dir="ltr" defaultValue={initial.titleEn ?? ""} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="descriptionHe">{t("descriptionHeLabel")}</Label>
        <Textarea id="descriptionHe" name="descriptionHe" rows={5} dir="rtl" defaultValue={initial.descriptionHe ?? ""} />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="useSeparateYad2Description"
          checked={separateYad2}
          onChange={(e) => setSeparateYad2(e.target.checked)}
          className="h-4 w-4"
        />
        {t("separateYad2Label")}
      </label>

      {separateYad2 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="descriptionYad2">{t("descriptionYad2Label")}</Label>
          <Textarea id="descriptionYad2" name="descriptionYad2" rows={5} dir="rtl" defaultValue={initial.descriptionYad2 ?? ""} />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="descriptionEn">{t("descriptionEnLabel")}</Label>
        <Textarea id="descriptionEn" name="descriptionEn" rows={5} dir="ltr" defaultValue={initial.descriptionEn ?? ""} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="yad2Package">{t("yad2PackageLabel")}</Label>
        <select
          id="yad2Package"
          name="yad2Package"
          defaultValue={initial.yad2Package ?? ""}
          className="h-11 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">{t("yad2PackageNone")}</option>
          <option value="premium">{t("yad2PackagePremium")}</option>
          <option value="ultra">{t("yad2PackageUltra")}</option>
        </select>
      </div>

      <Button type="submit" size="lg">
        {common("continue")}
      </Button>
    </form>
  );
}
