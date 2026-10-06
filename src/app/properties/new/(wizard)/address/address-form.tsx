"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { AddressAutocomplete } from "@/components/address-autocomplete";
import { verifyTypedAddress } from "@/lib/places-actions";
import type { AddressVerification, PlaceAddressDetails } from "@/lib/places";
import { PUBLISH_NOTES } from "@/lib/property-wizard/options";
import { PROPERTY_WIZARD_FORM_ID } from "@/lib/property-wizard/steps";
import { submitPropertyAddress } from "./actions";

interface Initial {
  formattedAddress?: string;
  city?: string;
  neighbourhood?: string;
  publishNotes?: string;
  street?: string;
  buildingNumber?: string;
  entrance?: string;
  apartmentNumber?: string;
  placeId?: string;
  lat?: number;
  lng?: number;
  addressManualOverride?: boolean;
}

/** The street address is always checked against Google (Places), whether it was
 *  typed, searched, or auto-filled from a signed contract: Google's spelling,
 *  city and place id replace what we had, but only after the agent confirms.
 *  Editing city/street/number afterwards drops the confirmation, so the
 *  address can't be changed to something Google never saw. The one escape hatch
 *  is an explicit "keep exactly as I typed it" for addresses Google doesn't know. */
export function AddressStepForm({
  initial,
  verification: initialVerification,
}: {
  initial: Initial;
  /** Server-side Google check of an address that arrived unverified (a contract pick). */
  verification?: AddressVerification;
}) {
  const t = useTranslations("PropertyAddressStep");
  const common = useTranslations("Common");
  const [resolved, setResolved] = useState({
    city: initial.city ?? "",
    neighbourhood: initial.neighbourhood ?? "",
    street: initial.street ?? "",
    buildingNumber: initial.buildingNumber ?? "",
    placeId: initial.placeId ?? "",
    formattedAddress: initial.formattedAddress ?? "",
    lat: initial.lat,
    lng: initial.lng,
  });
  const [apartmentNumber, setApartmentNumber] = useState(initial.apartmentNumber ?? "");
  const [verification, setVerification] = useState<AddressVerification | undefined>(initialVerification);
  const [dismissed, setDismissed] = useState(false);
  const [checking, setChecking] = useState(false);
  const [keepAsTyped, setKeepAsTyped] = useState(initial.addressManualOverride === true);

  const verified = !!resolved.placeId;
  const suggestion = !verified && !dismissed && verification?.status === "suggest" ? verification.details : undefined;

  /** Google's version replaces ours; the agent's building number stays when Google doesn't list one. */
  function applyGoogle(details: PlaceAddressDetails) {
    setResolved((s) => ({
      city: details.city ?? s.city,
      neighbourhood: details.neighbourhood ?? s.neighbourhood,
      street: details.street ?? s.street,
      buildingNumber: details.buildingNumber ?? s.buildingNumber,
      placeId: details.placeId,
      formattedAddress: details.formattedAddress,
      lat: details.lat ?? undefined,
      lng: details.lng ?? undefined,
    }));
    setKeepAsTyped(false);
    setDismissed(false);
    setVerification(undefined);
  }

  /** Typing in city/street/number invalidates an earlier confirmation. */
  function edit(patch: Partial<typeof resolved>) {
    setResolved((s) => ({ ...s, ...patch, placeId: "", formattedAddress: "", lat: undefined, lng: undefined }));
    setVerification(undefined);
    setDismissed(false);
  }

  async function checkTyped() {
    setChecking(true);
    try {
      const v = await verifyTypedAddress({
        city: resolved.city,
        street: resolved.street,
        buildingNumber: resolved.buildingNumber,
      });
      setDismissed(false);
      if (v.status === "verified" && v.details) applyGoogle(v.details);
      else setVerification(v);
    } finally {
      setChecking(false);
    }
  }

  return (
    <form id={PROPERTY_WIZARD_FORM_ID} action={submitPropertyAddress} className="flex flex-col gap-4">
      <AddressAutocomplete
        id="address-search"
        label={t("searchLabel")}
        defaultValue={resolved.formattedAddress}
        onResolved={applyGoogle}
      />
      <input type="hidden" name="placeId" value={resolved.placeId} />
      <input type="hidden" name="formattedAddress" value={resolved.formattedAddress} />
      {resolved.lat != null && <input type="hidden" name="lat" value={resolved.lat} />}
      {resolved.lng != null && <input type="hidden" name="lng" value={resolved.lng} />}

      {verified && (
        <Alert className="border-green-600/40 bg-green-50 dark:bg-green-950/20">
          <AlertDescription className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-700" aria-hidden />
            <span>{t("verifiedNote", { address: resolved.formattedAddress })}</span>
          </AlertDescription>
        </Alert>
      )}

      {suggestion && (
        <Alert className="border-primary/40 bg-primary/5">
          <AlertDescription className="flex flex-col gap-2">
            <span>
              {t("googleFound")} <strong dir="rtl">{suggestion.formattedAddress}</strong>
            </span>
            {!suggestion.buildingNumber && resolved.buildingNumber && (
              <span className="text-xs text-muted-foreground">
                {t("numberNotListed", { n: resolved.buildingNumber })}
              </span>
            )}
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={() => applyGoogle(suggestion)}>
                {t("useGoogle")}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setDismissed(true)}>
                {t("notThisOne")}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Field id="city" label={t("cityLabel")} required value={resolved.city} onChange={(v) => edit({ city: v })} />
        <Field
          id="neighbourhood"
          label={t("neighbourhoodLabel")}
          required
          value={resolved.neighbourhood}
          onChange={(v) => setResolved((s) => ({ ...s, neighbourhood: v }))}
        />
        <Field id="street" label={t("streetLabel")} required value={resolved.street} onChange={(v) => edit({ street: v })} />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Field
          id="buildingNumber"
          label={t("buildingNumberLabel")}
          required
          value={resolved.buildingNumber}
          onChange={(v) => edit({ buildingNumber: v })}
        />
        <Field id="entrance" label={t("entranceLabel")} defaultValue={initial.entrance} />
        <Field
          id="apartmentNumber"
          label={t("apartmentNumberLabel")}
          required
          hint={t("apartmentNumberHint")}
          value={apartmentNumber}
          onChange={setApartmentNumber}
        />
      </div>

      {!verified && (
        <div className="flex flex-col gap-2 rounded-md border border-amber-500/50 bg-amber-50 p-3 text-sm dark:bg-amber-950/20">
          <span className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
            {t(verification?.status === "none" || dismissed ? "couldNotVerify" : "notVerified")}
          </span>
          <div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={checking || !resolved.street}
              onClick={checkTyped}
            >
              {checking ? t("checking") : t("checkWithGoogle")}
            </Button>
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="addressManualOverride"
              checked={keepAsTyped}
              onChange={(e) => setKeepAsTyped(e.target.checked)}
              className="h-4 w-4"
            />
            {t("keepAsTyped")}
          </label>
        </div>
      )}

      <SearchableSelect
        rtl
        id="publishNotes"
        name="publishNotes"
        label={t("publishNotesLabel")}
        options={PUBLISH_NOTES.map((v) => ({ value: v, label: v }))}
        defaultValue={initial.publishNotes}
        placeholder={t("selectPlaceholder")}
        emptyLabel={t("selectPlaceholder")}
      />

      <Button type="submit" size="lg">
        {common("continue")}
      </Button>
    </form>
  );
}

function Field({
  id,
  label,
  required,
  hint,
  value,
  onChange,
  defaultValue,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  value?: string;
  onChange?: (v: string) => void;
  defaultValue?: string;
}) {
  const controlled = value !== undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-primary"> *</span>}
      </Label>
      <Input
        id={id}
        name={id}
        required={required}
        dir="rtl"
        {...(controlled
          ? { value, onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange?.(e.target.value) }
          : { defaultValue: defaultValue ?? "" })}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
