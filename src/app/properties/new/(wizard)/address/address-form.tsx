"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AddressAutocomplete } from "@/components/address-autocomplete";
import type { PlaceAddressDetails } from "@/lib/places";
import { PROPERTY_WIZARD_FORM_ID } from "@/lib/property-wizard/steps";
import { submitPropertyAddress } from "./actions";

interface Initial {
  formattedAddress?: string;
  city?: string;
  street?: string;
  buildingNumber?: string;
  entrance?: string;
  apartmentNumber?: string;
  placeId?: string;
  lat?: number;
  lng?: number;
}

/** Places resolves city/street/buildingNumber/placeId/lat/lng; entrance and
 *  apartment number aren't part of any address component Places returns,
 *  so they stay plain editable fields regardless of what was picked. Every
 *  Places-filled field stays editable too — same "prefill, never lock"
 *  rule as the deal wizard's picker steps. */
export function AddressStepForm({ initial }: { initial: Initial }) {
  const t = useTranslations("PropertyAddressStep");
  const common = useTranslations("Common");
  const [resolved, setResolved] = useState({
    city: initial.city ?? "",
    street: initial.street ?? "",
    buildingNumber: initial.buildingNumber ?? "",
    placeId: initial.placeId ?? "",
    formattedAddress: initial.formattedAddress ?? "",
    lat: initial.lat,
    lng: initial.lng,
  });
  const [apartmentNumber, setApartmentNumber] = useState(initial.apartmentNumber ?? "");

  function handleResolved(details: PlaceAddressDetails) {
    setResolved({
      city: details.city ?? resolved.city,
      street: details.street ?? resolved.street,
      buildingNumber: details.buildingNumber ?? resolved.buildingNumber,
      placeId: details.placeId,
      formattedAddress: details.formattedAddress,
      lat: details.lat ?? undefined,
      lng: details.lng ?? undefined,
    });
  }

  return (
    <form id={PROPERTY_WIZARD_FORM_ID} action={submitPropertyAddress} className="flex flex-col gap-4">
      <AddressAutocomplete
        id="address-search"
        label={t("searchLabel")}
        defaultValue={resolved.formattedAddress}
        onResolved={handleResolved}
      />
      <input type="hidden" name="placeId" value={resolved.placeId} />
      <input type="hidden" name="formattedAddress" value={resolved.formattedAddress} />
      {resolved.lat != null && <input type="hidden" name="lat" value={resolved.lat} />}
      {resolved.lng != null && <input type="hidden" name="lng" value={resolved.lng} />}

      <div className="grid grid-cols-2 gap-4">
        <Field
          id="city"
          label={t("cityLabel")}
          required
          value={resolved.city}
          onChange={(v) => setResolved((s) => ({ ...s, city: v }))}
        />
        <Field
          id="street"
          label={t("streetLabel")}
          required
          value={resolved.street}
          onChange={(v) => setResolved((s) => ({ ...s, street: v }))}
        />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Field
          id="buildingNumber"
          label={t("buildingNumberLabel")}
          required
          value={resolved.buildingNumber}
          onChange={(v) => setResolved((s) => ({ ...s, buildingNumber: v }))}
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
