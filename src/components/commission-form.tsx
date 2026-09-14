"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Lock } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/phone-input";
import { WizardSubmitButton } from "@/components/wizard-submit-button";
import { WIZARD_FORM_ID } from "@/lib/wizard/steps";
import type { CommissionInput, CommissionUnit, VatMode } from "@/lib/wizard/draft";
import {
  computeExpectedBillPreVat,
  computeNormalizedCommissionPercent,
  computeReferralNormalizedPercent,
} from "@/lib/wizard/commission";

/** What a page's server-side prefill lookup hands to this component — kept
 *  separate from the draft's own CommissionInput/ReferralInput shapes since
 *  prefill data is read-only board data, not yet a saved form answer. */
export interface CommissionPrefill {
  unit: CommissionUnit;
  amount: number;
  vatMode: VatMode;
  referral?: {
    agentName: string;
    officeName?: string;
    phone: string;
    /** Board-sourced referral prefill is always a plain percentage. */
    percent: number;
  };
}

interface Props {
  dealType: "sale" | "rental";
  /** draft.priceTerms.price — for rentals this is the monthly rent. */
  price: number | undefined;
  action: (formData: FormData) => void;
  /** Already-saved draft value, on a revisit. Takes priority over prefill. */
  initial?: CommissionInput;
  /** Server-fetched board data — only used to seed initial state when
   *  `initial` is unset (never overwrites an agent's own saved answer). */
  prefill: CommissionPrefill | null;
}

/**
 * Shared by both the owner-commission and buyer-commission steps. Entirely
 * internal-use data — never in the PDF (see the banner). Reuses the pill-
 * toggle pattern already established in persons-form.tsx's communication-
 * language picker (`has-[:checked]`, no JS needed for the toggle's own
 * visual state) and the property-form.tsx/party-form.tsx toggle-mode
 * component split.
 */
export function CommissionForm({ dealType, price, action, initial, prefill }: Props) {
  const t = useTranslations("CommissionForm");
  const locale = useLocale();

  const [unit, setUnit] = useState<CommissionUnit>(
    initial?.unit ?? prefill?.unit ?? "percentage",
  );
  const [amountText, setAmountText] = useState(
    String(initial?.amount ?? prefill?.amount ?? ""),
  );
  const [vatMode, setVatMode] = useState<VatMode>(
    initial?.vatMode ?? prefill?.vatMode ?? "plus",
  );

  const [hasReferral, setHasReferral] = useState<"yes" | "no">(
    initial?.referral || prefill?.referral ? "yes" : "no",
  );
  const [referralAgentName, setReferralAgentName] = useState(
    initial?.referral?.agentName ?? prefill?.referral?.agentName ?? "",
  );
  const [referralOfficeName, setReferralOfficeName] = useState(
    initial?.referral?.officeName ?? prefill?.referral?.officeName ?? "",
  );
  const [referralUnit, setReferralUnit] = useState<"percentage" | "shekel">(
    initial?.referral?.unit ?? "percentage",
  );
  const [referralAmountText, setReferralAmountText] = useState(
    String(initial?.referral?.amount ?? prefill?.referral?.percent ?? ""),
  );
  const [referralVatMode, setReferralVatMode] = useState<VatMode>(
    initial?.referral?.vatMode ?? "plus",
  );

  const unitOptions =
    dealType === "rental" ? (["percentage", "shekel", "months"] as const) : (["percentage", "shekel"] as const);
  const unitLabel = (opt: CommissionUnit) =>
    opt === "percentage" ? t("unitPercentage") : opt === "shekel" ? t("unitShekel") : t("unitMonths");
  const vatLabel = (opt: VatMode) => (opt === "plus" ? t("vatPlus") : t("vatIncluded"));

  const amount = Number(amountText) || 0;
  const normalizedPct = useMemo(
    () => computeNormalizedCommissionPercent({ unit, amount, vatMode }, price),
    [unit, amount, vatMode, price],
  );
  const expectedBill = useMemo(
    () => computeExpectedBillPreVat(normalizedPct, price),
    [normalizedPct, price],
  );

  const referralAmount = Number(referralAmountText) || 0;
  const referralNormalizedPct = useMemo(
    () =>
      hasReferral === "yes"
        ? computeReferralNormalizedPercent(
            normalizedPct,
            { unit: referralUnit, amount: referralAmount, vatMode: referralVatMode },
            price,
          )
        : null,
    [hasReferral, normalizedPct, referralUnit, referralAmount, referralVatMode, price],
  );
  const referralExpectedBill = useMemo(
    () => computeExpectedBillPreVat(referralNormalizedPct, price),
    [referralNormalizedPct, price],
  );

  const wasPrefilled = !initial && Boolean(prefill);

  return (
    <form id={WIZARD_FORM_ID} action={action} className="flex flex-col gap-6">
      <Alert variant="info">
        <Lock className="h-4 w-4" aria-hidden />
        <AlertDescription>
          <p className="font-semibold">{t("bannerTitle")}</p>
          <p>{t("bannerBody")}</p>
        </AlertDescription>
      </Alert>

      <fieldset className="flex flex-col gap-3 rounded-lg border p-4">
        <legend className="px-1 text-sm font-semibold">{t("commissionLabel")}</legend>

        <PillToggle name="unit" options={unitOptions} value={unit} onChange={setUnit} labelFor={unitLabel} />

        <Input
          type="number"
          inputMode="decimal"
          name="amount"
          dir="ltr"
          className="text-left"
          value={amountText}
          onChange={(e) => setAmountText(e.target.value)}
        />

        <PillToggle name="vatMode" options={["plus", "included"] as const} value={vatMode} onChange={setVatMode} labelFor={vatLabel} />

        {expectedBill !== null && normalizedPct !== null && (
          <p className="text-sm text-muted-foreground">
            {t("expectedBillValue", {
              amount: formatIls(expectedBill, locale),
              percent: normalizedPct.toFixed(2),
            })}
          </p>
        )}

        {wasPrefilled && <p className="text-xs text-primary">{t("prefillNote")}</p>}
      </fieldset>

      <fieldset className="flex flex-col gap-3 rounded-lg border p-4">
        <legend className="px-1 text-sm font-semibold">{t("referralPrompt")}</legend>

        <PillToggle
          name="hasReferral"
          options={["yes", "no"] as const}
          value={hasReferral}
          onChange={setHasReferral}
          labelFor={(opt) => (opt === "yes" ? t("referralYes") : t("referralNo"))}
        />

        {hasReferral === "yes" && (
          <div className="flex flex-col gap-3">
            <Field
              id="referralAgentName"
              label={t("referralAgentNameLabel")}
              required
              value={referralAgentName}
              onChange={setReferralAgentName}
            />
            <Field
              id="referralOfficeName"
              label={t("referralOfficeNameLabel")}
              value={referralOfficeName}
              onChange={setReferralOfficeName}
            />
            <PhoneInput
              id="referralPhone"
              label={t("referralPhoneLabel")}
              required
              defaultValue={initial?.referral?.phone ?? prefill?.referral?.phone}
            />

            <Label>{t("referralCommissionLabel")}</Label>
            <PillToggle
              name="referralUnit"
              options={["percentage", "shekel"] as const}
              value={referralUnit}
              onChange={setReferralUnit}
              labelFor={(opt) => (opt === "percentage" ? t("unitPercentage") : t("unitShekel"))}
            />
            <Input
              type="number"
              inputMode="decimal"
              name="referralAmount"
              dir="ltr"
              className="text-left"
              value={referralAmountText}
              onChange={(e) => setReferralAmountText(e.target.value)}
            />
            <PillToggle
              name="referralVatMode"
              options={["plus", "included"] as const}
              value={referralVatMode}
              onChange={setReferralVatMode}
              labelFor={vatLabel}
            />

            {referralExpectedBill !== null && referralNormalizedPct !== null && (
              <p className="text-sm text-muted-foreground">
                {t("expectedBillValue", {
                  amount: formatIls(referralExpectedBill, locale),
                  percent: referralNormalizedPct.toFixed(2),
                })}
              </p>
            )}
          </div>
        )}
      </fieldset>

      <WizardSubmitButton />
    </form>
  );
}

function PillToggle<T extends string>({
  name,
  options,
  value,
  onChange,
  labelFor,
}: {
  name: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  labelFor: (opt: T) => string;
}) {
  return (
    <div className="flex gap-2">
      {options.map((opt) => (
        <label
          key={opt}
          className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border border-input p-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5"
        >
          <input
            type="radio"
            name={name}
            value={opt}
            checked={value === opt}
            onChange={() => onChange(opt)}
            className="sr-only"
          />
          <span>{labelFor(opt)}</span>
        </label>
      ))}
    </div>
  );
}

function Field({
  id,
  label,
  required,
  value,
  onChange,
}: {
  id: string;
  label: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-primary"> *</span>}
      </Label>
      <Input id={id} name={id} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function formatIls(amount: number, locale: string): string {
  return `₪${Math.round(amount).toLocaleString(locale)}`;
}
