import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth/session-cookie";
import { loadPropertyDraft } from "@/lib/property-wizard/draft";
import { PropertyWizardChrome } from "@/components/property-wizard-chrome";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/searchable-select";
import { PROPERTY_WIZARD_FORM_ID } from "@/lib/property-wizard/steps";
import { submitPropertyTechnical } from "./actions";

export default async function PropertyTechnicalPage() {
  const session = await requireSession();
  const draft = await loadPropertyDraft(session.agentId);
  if (!draft.street) redirect("/properties/new/address");
  const t = await getTranslations("PropertyTechnicalStep");
  const common = await getTranslations("Common");

  return (
    <PropertyWizardChrome step="technical" furthestStep={draft.furthestStep} returnToSummaryBehavior="link">
      <form id={PROPERTY_WIZARD_FORM_ID} action={submitPropertyTechnical} className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">{t("prompt")}</p>

        <div className="grid grid-cols-4 gap-2">
          <NumField id="rooms" label={t("roomsLabel")} defaultValue={draft.rooms} />
          <NumField id="bedrooms" label={t("bedroomsLabel")} defaultValue={draft.bedrooms} />
          <NumField id="toilets" label={t("toiletsLabel")} defaultValue={draft.toilets} />
          <NumField id="bathrooms" label={t("bathroomsLabel")} defaultValue={draft.bathrooms} />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <NumField id="floor" label={t("floorLabel")} defaultValue={draft.floor} />
          <NumField id="floorsTotal" label={t("floorsTotalLabel")} defaultValue={draft.floorsTotal} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="levels">{t("levelsLabel")}</Label>
            <Input id="levels" name="levels" defaultValue={draft.levels ?? ""} dir="ltr" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <NumField id="sizeSqm" label={t("sizeSqmLabel")} defaultValue={draft.sizeSqm} />
          <NumField id="plotSizeSqm" label={t("plotSizeSqmLabel")} defaultValue={draft.plotSizeSqm} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <NumField id="askingPrice" label={t("askingPriceLabel")} defaultValue={draft.askingPrice} />
          <NumField id="startingPrice" label={t("startingPriceLabel")} defaultValue={draft.startingPrice} />
        </div>

        <SearchableSelect
          id="condition"
          name="condition"
          label={t("conditionLabel")}
          options={Object.entries(t.raw("condition") as Record<string, string>).map(
            ([value, label]) => ({ value, label }),
          )}
          defaultValue={draft.condition}
          placeholder={t("selectPlaceholder")}
          searchPlaceholder={t("selectPlaceholder")}
        />

        <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-md border p-3">
          <BoolField id="elevator" label={t("elevatorLabel")} checked={draft.elevator} />
          <BoolField id="ac" label={t("acLabel")} checked={draft.ac} />
          <BoolField id="safeRoom" label={t("safeRoomLabel")} checked={draft.safeRoom} />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <BoolWithSize idBool="balcony" idSize="balconySizeSqm" label={t("balconyLabel")} checked={draft.balcony} size={draft.balconySizeSqm} />
          <BoolWithSize idBool="garden" idSize="gardenSizeSqm" label={t("gardenLabel")} checked={draft.garden} size={draft.gardenSizeSqm} />
          <BoolWithSize idBool="parking" idSize="parkingCount" label={t("parkingLabel")} checked={draft.parking} size={draft.parkingCount} />
          <BoolWithSize idBool="storage" idSize="storageSizeSqm" label={t("storageLabel")} checked={draft.storage} size={draft.storageSizeSqm} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="additionalFeatures">{t("additionalFeaturesLabel")}</Label>
          <Input
            id="additionalFeatures"
            name="additionalFeatures"
            dir="rtl"
            placeholder={t("additionalFeaturesPlaceholder")}
            defaultValue={draft.additionalFeatures?.join(", ") ?? ""}
          />
        </div>

        <Button type="submit" size="lg">
          {common("continue")}
        </Button>
      </form>
    </PropertyWizardChrome>
  );
}

function NumField({ id, label, defaultValue }: { id: string; label: string; defaultValue?: number }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={id} type="number" inputMode="decimal" dir="ltr" defaultValue={defaultValue?.toString() ?? ""} />
    </div>
  );
}

function BoolField({ id, label, checked }: { id: string; label: string; checked?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" name={id} defaultChecked={checked} className="h-4 w-4" />
      {label}
    </label>
  );
}

function BoolWithSize({
  idBool,
  idSize,
  label,
  checked,
  size,
}: {
  idBool: string;
  idSize: string;
  label: string;
  checked?: boolean;
  size?: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="flex flex-1 items-center gap-2 text-sm">
        <input type="checkbox" name={idBool} defaultChecked={checked} className="h-4 w-4" />
        {label}
      </label>
      <Input
        name={idSize}
        type="number"
        inputMode="decimal"
        className="w-20"
        dir="ltr"
        defaultValue={size?.toString() ?? ""}
      />
    </div>
  );
}
