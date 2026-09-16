"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import type { PropertyRecord } from "@/lib/types";
import { submitPropertyEdit } from "./actions";

const PROPERTY_STATUSES = ["active", "sold", "rented", "off_market", "withdrawn"] as const;

export function EditPropertyForm({ property }: { property: PropertyRecord }) {
  const t = useTranslations("PropertyEdit");
  const tDetails = useTranslations("PropertyDetailsStep");
  const tTechnical = useTranslations("PropertyTechnicalStep");
  const tStatus = useTranslations("Enums.propertyStatus");

  const statusOptions = useMemo(
    () => PROPERTY_STATUSES.map((v) => ({ value: v, label: tStatus(v) })),
    [tStatus],
  );
  const propertyTypeOptions = useMemo(() => {
    const raw = tDetails.raw("propertyType") as Record<string, string>;
    return Object.entries(raw).map(([value, label]) => ({ value, label }));
  }, [tDetails]);
  const referralSourceOptions = useMemo(() => {
    const raw = tDetails.raw("referralSource") as Record<string, string>;
    return Object.entries(raw).map(([value, label]) => ({ value, label }));
  }, [tDetails]);
  const conditionOptions = useMemo(() => {
    const raw = tTechnical.raw("condition") as Record<string, string>;
    return Object.entries(raw).map(([value, label]) => ({ value, label }));
  }, [tTechnical]);

  return (
    <form action={submitPropertyEdit} className="flex flex-col gap-5">
      <input type="hidden" name="propertyId" value={property.id} />

      <Section title={t("statusTitle")}>
        <SearchableSelect
          rtl
          id="status"
          name="status"
          options={statusOptions}
          defaultValue={property.status}
          placeholder={t("selectPlaceholder")}
          emptyLabel={t("selectPlaceholder")}
        />
      </Section>

      <Section title={t("addressTitle")}>
        <div className="grid grid-cols-2 gap-4">
          <Field id="city" label={t("cityLabel")} defaultValue={property.city} />
          <Field id="street" label={t("streetLabel")} defaultValue={property.street} />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Field id="buildingNumber" label={t("buildingNumberLabel")} defaultValue={property.buildingNumber} />
          <Field id="entrance" label={t("entranceLabel")} defaultValue={property.entrance} />
          <Field id="apartmentNumber" label={t("apartmentNumberLabel")} defaultValue={property.apartmentNumber} />
        </div>
      </Section>

      <Section title={t("ownerTitle")}>
        <Field id="ownerName" label={t("ownerNameLabel")} defaultValue={property.ownerName} />
        <div className="grid grid-cols-2 gap-4">
          <Field id="ownerPhone" label={t("ownerPhoneLabel")} defaultValue={property.ownerPhone} dir="ltr" />
          <Field id="ownerEmail" label={t("ownerEmailLabel")} defaultValue={property.ownerEmail} dir="ltr" />
        </div>
      </Section>

      <Section title={t("commissionTitle")}>
        <div className="grid grid-cols-2 gap-4">
          <Field
            id="commissionPercent"
            label={t("percentLabel")}
            type="number"
            defaultValue={property.commissionPercent?.toString()}
            dir="ltr"
          />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="commissionVatMode">{t("vatModeLabel")}</Label>
            <select
              id="commissionVatMode"
              name="commissionVatMode"
              defaultValue={property.commissionVatMode ?? "plus"}
              className="h-11 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="plus">{t("vatPlus")}</option>
              <option value="included">{t("vatIncluded")}</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field
            id="exclusivityStartDate"
            label={t("exclusivityStartLabel")}
            type="date"
            defaultValue={property.exclusivityStartDate}
            dir="ltr"
          />
          <Field
            id="exclusivityEndDate"
            label={t("exclusivityEndLabel")}
            type="date"
            defaultValue={property.exclusivityEndDate}
            dir="ltr"
          />
        </div>
      </Section>

      <Section title={t("detailsTitle")}>
        <SearchableSelect
          rtl
          id="propertyType"
          name="propertyType"
          label={tDetails("propertyTypeLabel")}
          options={propertyTypeOptions}
          defaultValue={property.propertyType}
          placeholder={tDetails("selectPlaceholder")}
          emptyLabel={tDetails("selectPlaceholder")}
        />
        <SearchableSelect
          rtl
          id="referralSource"
          name="referralSource"
          label={tDetails("referralSourceLabel")}
          options={referralSourceOptions}
          defaultValue={property.referralSource}
          placeholder={tDetails("selectPlaceholder")}
          emptyLabel={tDetails("selectPlaceholder")}
        />
      </Section>

      <Section title={t("descriptionsTitle")}>
        <div className="grid grid-cols-2 gap-4">
          <Field id="titleHe" label={t("titleHeLabel")} defaultValue={property.titleHe} />
          <Field id="titleEn" label={t("titleEnLabel")} defaultValue={property.titleEn} dir="ltr" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="descriptionHe">{t("descriptionHeLabel")}</Label>
          <Textarea id="descriptionHe" name="descriptionHe" rows={4} dir="rtl" defaultValue={property.descriptionHe ?? ""} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="descriptionEn">{t("descriptionEnLabel")}</Label>
          <Textarea id="descriptionEn" name="descriptionEn" rows={4} dir="ltr" defaultValue={property.descriptionEn ?? ""} />
        </div>
      </Section>

      <Section title={t("technicalTitle")}>
        <div className="grid grid-cols-3 gap-4">
          <Field id="rooms" label={t("roomsLabel")} type="number" defaultValue={property.rooms?.toString()} dir="ltr" />
          <Field id="sizeSqm" label={t("sizeSqmLabel")} type="number" defaultValue={property.sizeSqm?.toString()} dir="ltr" />
          <Field id="floor" label={t("floorLabel")} type="number" defaultValue={property.floor?.toString()} dir="ltr" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field
            id="askingPrice"
            label={t("askingPriceLabel")}
            type="number"
            defaultValue={property.askingPrice?.toString()}
            dir="ltr"
          />
          <Field
            id="startingPrice"
            label={t("startingPriceLabel")}
            type="number"
            defaultValue={property.startingPrice?.toString()}
            dir="ltr"
          />
        </div>
        <SearchableSelect
          rtl
          id="condition"
          name="condition"
          label={tTechnical("conditionLabel")}
          options={conditionOptions}
          defaultValue={property.condition}
          placeholder={tTechnical("selectPlaceholder")}
          emptyLabel={tTechnical("selectPlaceholder")}
        />
      </Section>

      <p className="text-xs text-muted-foreground">{t("notifyNote")}</p>

      <Button type="submit" size="lg">
        {t("save")}
      </Button>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <h2 className="text-sm font-semibold text-muted-foreground">{title}</h2>
      {children}
    </div>
  );
}

function Field({
  id,
  label,
  type = "text",
  defaultValue,
  dir,
}: {
  id: string;
  label: string;
  type?: string;
  defaultValue?: string;
  dir?: "ltr" | "rtl";
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={id} type={type} defaultValue={defaultValue ?? ""} dir={dir ?? "rtl"} />
    </div>
  );
}
