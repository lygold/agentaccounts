"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const DEFAULT_COUNTRY: CountryCode = "IL";

// Israel first (this is an Israeli brokerage's default), then the rest by
// calling code so the list is at least predictably ordered.
const COUNTRY_OPTIONS: CountryCode[] = [
  DEFAULT_COUNTRY,
  ...getCountries()
    .filter((c) => c !== DEFAULT_COUNTRY)
    .sort(
      (a, b) => Number(getCountryCallingCode(a)) - Number(getCountryCallingCode(b)),
    ),
];

function flagEmoji(country: CountryCode): string {
  return country
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

function parseInitial(raw: string): { country: CountryCode; national: string } {
  if (!raw.trim()) return { country: DEFAULT_COUNTRY, national: "" };
  const parsed = parsePhoneNumberFromString(raw, DEFAULT_COUNTRY);
  if (parsed) {
    return { country: (parsed.country as CountryCode) ?? DEFAULT_COUNTRY, national: parsed.formatNational() };
  }
  return { country: DEFAULT_COUNTRY, national: raw };
}

interface PhoneInputProps {
  id: string;
  label?: string;
  required?: boolean;
  requiredHint?: string;
  defaultValue?: string;
}

/**
 * Phone field with a country picker. Auto-detects the country from a typed
 * "+" prefix (e.g. "+1..." -> US), and the flag can be clicked to override
 * manually. Submits a single E.164-ish value via a hidden input named `id` —
 * the visible select + text input are UI only, so this drops into both
 * controlled (persons-form) and uncontrolled (party-form) parents the same
 * way: give it a fresh `key` if you need to force it to re-seed from a new
 * `defaultValue` (e.g. after picking a client from a picker).
 */
export function PhoneInput({
  id,
  label,
  required,
  requiredHint,
  defaultValue = "",
}: PhoneInputProps) {
  const t = useTranslations("PhoneInput");
  const [state, setState] = useState(() => parseInitial(defaultValue));

  const combined = useMemo(() => {
    const trimmed = state.national.trim();
    if (!trimmed) return "";
    const parsed = parsePhoneNumberFromString(trimmed, state.country);
    if (parsed) return parsed.number; // E.164, e.g. "+972547929532"
    // Not a fully parseable number yet — still submit the digits typed so
    // far under the selected country's calling code rather than losing them.
    const digits = trimmed.replace(/\D/g, "");
    return digits ? `+${getCountryCallingCode(state.country)}${digits}` : "";
  }, [state.country, state.national]);

  function handleNationalChange(value: string) {
    if (value.startsWith("+")) {
      const parsed = parsePhoneNumberFromString(value);
      if (parsed?.country && parsed.isValid()) {
        setState({ country: parsed.country as CountryCode, national: parsed.formatNational() });
        return;
      }
    }
    setState((s) => ({ ...s, national: value }));
  }

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <Label htmlFor={id}>
          {label}
          {required && (
            <span className="text-primary">
              {" *"}
              {requiredHint && (
                <span className="ms-1 text-xs font-normal text-muted-foreground">
                  {requiredHint}
                </span>
              )}
            </span>
          )}
        </Label>
      )}
      <div className="flex gap-2" dir="ltr">
        <select
          aria-label={t("countryCodeLabel")}
          value={state.country}
          onChange={(e) =>
            setState((s) => ({ ...s, country: e.target.value as CountryCode }))
          }
          className="h-11 w-[90px] shrink-0 rounded-md border border-input bg-background px-1.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {COUNTRY_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {flagEmoji(c)} +{getCountryCallingCode(c)}
            </option>
          ))}
        </select>
        <Input
          id={id}
          type="tel"
          inputMode="tel"
          dir="ltr"
          className="flex-1"
          value={state.national}
          onChange={(e) => handleNationalChange(e.target.value)}
        />
      </div>
      <input type="hidden" name={id} value={combined} readOnly />
    </div>
  );
}
