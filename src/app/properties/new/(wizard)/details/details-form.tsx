"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { PROPERTY_WIZARD_FORM_ID } from "@/lib/property-wizard/steps";
import { submitPropertyDetails } from "./actions";

interface Initial {
  propertyType?: string;
  referralSource?: string;
  referralSourceOther?: string;
  externalReferringAgentName?: string;
  externalReferringAgentOffice?: string;
  externalReferringAgentPhone?: string;
  referralPercentOfCommission?: number;
}

/** Property type / referral source / external referring agent — the
 *  "how did this listing come to us" step. Type/source option lists are
 *  a reasonable standard set, not pulled from Monday's exact dropdown
 *  values (not reconciled against those yet) — fine as a v1, easy to
 *  adjust later without touching the data model (both are plain strings
 *  on PropertyRecord, not enums). */
export function DetailsStepForm({ initial }: { initial: Initial }) {
  const t = useTranslations("PropertyDetailsStep");
  const common = useTranslations("Common");
  const [referralSource, setReferralSource] = useState(initial.referralSource ?? "");
  const isOther = referralSource === "other";
  const isExternalAgent = referralSource === "externalAgent";

  const propertyTypeOptions = useMemo(() => {
    const raw = t.raw("propertyType") as Record<string, string>;
    return Object.entries(raw).map(([value, label]) => ({ value, label }));
  }, [t]);
  const referralSourceOptions = useMemo(() => {
    const raw = t.raw("referralSource") as Record<string, string>;
    return Object.entries(raw).map(([value, label]) => ({ value, label }));
  }, [t]);

  return (
    <form id={PROPERTY_WIZARD_FORM_ID} action={submitPropertyDetails} className="flex flex-col gap-4">
      <SearchableSelect
        rtl
        id="propertyType"
        name="propertyType"
        label={t("propertyTypeLabel")}
        options={propertyTypeOptions}
        defaultValue={initial.propertyType}
        placeholder={t("selectPlaceholder")}
        emptyLabel={t("selectPlaceholder")}
      />

      <SearchableSelect
        rtl
        id="referralSource"
        name="referralSource"
        label={t("referralSourceLabel")}
        options={referralSourceOptions}
        defaultValue={initial.referralSource}
        placeholder={t("selectPlaceholder")}
        emptyLabel={t("selectPlaceholder")}
        onChange={setReferralSource}
      />

      {isOther && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="referralSourceOther">{t("referralSourceOtherLabel")}</Label>
          <Input id="referralSourceOther" name="referralSourceOther" defaultValue={initial.referralSourceOther ?? ""} dir="rtl" />
        </div>
      )}

      {isExternalAgent && (
        <div className="flex flex-col gap-3 rounded-md border p-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="externalReferringAgentName">{t("externalAgentNameLabel")}</Label>
            <Input
              id="externalReferringAgentName"
              name="externalReferringAgentName"
              defaultValue={initial.externalReferringAgentName ?? ""}
              dir="rtl"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="externalReferringAgentOffice">{t("externalAgentOfficeLabel")}</Label>
              <Input
                id="externalReferringAgentOffice"
                name="externalReferringAgentOffice"
                defaultValue={initial.externalReferringAgentOffice ?? ""}
                dir="rtl"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="externalReferringAgentPhone">{t("externalAgentPhoneLabel")}</Label>
              <Input
                id="externalReferringAgentPhone"
                name="externalReferringAgentPhone"
                type="tel"
                dir="ltr"
                defaultValue={initial.externalReferringAgentPhone ?? ""}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="referralPercentOfCommission">{t("referralPercentLabel")}</Label>
            <Input
              id="referralPercentOfCommission"
              name="referralPercentOfCommission"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              max="100"
              dir="ltr"
              defaultValue={initial.referralPercentOfCommission?.toString() ?? ""}
            />
          </div>
        </div>
      )}

      <Button type="submit" size="lg">
        {common("continue")}
      </Button>
    </form>
  );
}
