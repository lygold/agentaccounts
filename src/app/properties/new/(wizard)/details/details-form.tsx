"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { PROPERTY_WIZARD_FORM_ID } from "@/lib/property-wizard/steps";
import {
  OTHER_SOURCES,
  PROPERTY_TYPES,
  REFERRAL_EXTERNAL_AGENT,
  REFERRAL_NONE,
  REFERRAL_OFFICE_AGENT,
  REFERRAL_SOURCES,
} from "@/lib/property-wizard/options";
import { submitPropertyDetails } from "./actions";

interface Initial {
  propertyType?: string;
  referralSource?: string;
  referralSourceOther?: string;
  externalReferringAgentName?: string;
  externalReferringAgentOffice?: string;
  externalReferringAgentPhone?: string;
  referralPercentOfCommission?: number;
  ownerName?: string;
  ownerPhone?: string;
  ownerEmail?: string;
}

/** Property type / referral source / owner - the "how did this listing come
 *  to us" step. Every option list is the Monday board's own (see
 *  src/lib/property-wizard/options.ts), and the stored value is that label.
 *  Conditional questions follow the original questionnaire: "לא" asks where
 *  the client came from; the two referral choices ask for the percentage,
 *  external agent also the agent's details. */
export function DetailsStepForm({ initial }: { initial: Initial }) {
  const t = useTranslations("PropertyDetailsStep");
  const common = useTranslations("Common");
  const [referralSource, setReferralSource] = useState(initial.referralSource ?? "");
  // "לא" (not a referral) asks where the client DID come from; the two
  // referral choices ask for the referral percentage, external also the agent.
  const isOther = referralSource === REFERRAL_NONE;
  const isExternalAgent = referralSource === REFERRAL_EXTERNAL_AGENT;
  const isReferral = isExternalAgent || referralSource === REFERRAL_OFFICE_AGENT;

  const propertyTypeOptions = useMemo(() => PROPERTY_TYPES.map((v) => ({ value: v, label: v })), []);
  const referralSourceOptions = useMemo(() => REFERRAL_SOURCES.map((v) => ({ value: v, label: v })), []);
  const otherSourceOptions = useMemo(() => OTHER_SOURCES.map((v) => ({ value: v, label: v })), []);

  return (
    <form id={PROPERTY_WIZARD_FORM_ID} action={submitPropertyDetails} className="flex flex-col gap-4">
      <SearchableSelect
        rtl
        id="propertyType"
        name="propertyType"
        required
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
        required
        label={t("referralSourceLabel")}
        options={referralSourceOptions}
        defaultValue={initial.referralSource}
        placeholder={t("selectPlaceholder")}
        emptyLabel={t("selectPlaceholder")}
        onChange={setReferralSource}
      />

      {isOther && (
        <SearchableSelect
          rtl
          id="referralSourceOther"
          name="referralSourceOther"
          required
          label={t("referralSourceOtherLabel")}
          options={otherSourceOptions}
          defaultValue={initial.referralSourceOther}
          placeholder={t("selectPlaceholder")}
          emptyLabel={t("selectPlaceholder")}
        />
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
        </div>
      )}

      {isReferral && (
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
      )}

      <div className="flex flex-col gap-3 rounded-md border p-3">
        <p className="text-sm font-medium">{t("ownerSectionTitle")}</p>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ownerName">
            {t("ownerNameLabel")}
            <span className="text-primary"> *</span>
          </Label>
          <Input id="ownerName" name="ownerName" required dir="rtl" defaultValue={initial.ownerName ?? ""} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ownerPhone">
              {t("ownerPhoneLabel")}
              <span className="text-primary"> *</span>
            </Label>
            <Input id="ownerPhone" name="ownerPhone" required type="tel" dir="ltr" defaultValue={initial.ownerPhone ?? ""} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ownerEmail">
              {t("ownerEmailLabel")}
              <span className="text-primary"> *</span>
            </Label>
            <Input id="ownerEmail" name="ownerEmail" required type="email" dir="ltr" defaultValue={initial.ownerEmail ?? ""} />
          </div>
        </div>
      </div>

      <Button type="submit" size="lg">
        {common("continue")}
      </Button>
    </form>
  );
}
