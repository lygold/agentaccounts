import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth/session-cookie";
import { loadPropertyDraft } from "@/lib/property-wizard/draft";
import { PropertyWizardChrome } from "@/components/property-wizard-chrome";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  ADDITIONAL_FEATURES,
  AIR_CONDITIONING,
  BALCONY,
  CONDITIONS,
  ELEVATOR,
  PARKING,
  YES_NO,
} from "@/lib/property-wizard/options";
import { PROPERTY_WIZARD_FORM_ID } from "@/lib/property-wizard/steps";
import { submitPropertyTechnical } from "./actions";

const SELECT_CLASS =
  "h-11 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default async function PropertyTechnicalPage() {
  const session = await requireSession();
  const draft = await loadPropertyDraft(session.agentId);
  if (!draft.street) redirect("/properties/new/address");
  const t = await getTranslations("PropertyTechnicalStep");
  const common = await getTranslations("Common");
  const selected = new Set(draft.additionalFeatures ?? []);

  return (
    <PropertyWizardChrome step="technical" furthestStep={draft.furthestStep} returnToSummaryBehavior="link">
      <form id={PROPERTY_WIZARD_FORM_ID} action={submitPropertyTechnical} className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">{t("prompt")}</p>

        <div className="grid grid-cols-2 gap-2">
          <NumField id="rooms" label={t("roomsLabel")} required defaultValue={draft.rooms} />
          <NumField id="bedrooms" label={t("bedroomsLabel")} required defaultValue={draft.bedrooms} />
          <NumField id="toilets" label={t("toiletsLabel")} required defaultValue={draft.toilets} />
          <NumField id="bathrooms" label={t("bathroomsLabel")} defaultValue={draft.bathrooms} />
        </div>

        <SelectField
          id="masterSuite"
          label={t("masterSuiteLabel")}
          required
          options={YES_NO}
          value={draft.masterSuite}
          placeholder={t("selectPlaceholder")}
        />

        <div className="grid grid-cols-3 gap-2">
          <NumField id="floor" label={t("floorLabel")} required defaultValue={draft.floor} />
          <NumField id="floorsTotal" label={t("floorsTotalLabel")} required defaultValue={draft.floorsTotal} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="levels">{t("levelsLabel")}</Label>
            <Input id="levels" name="levels" defaultValue={draft.levels ?? ""} dir="ltr" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <NumField id="sizeSqm" label={t("sizeSqmLabel")} required defaultValue={draft.sizeSqm} />
          <NumField id="plotSizeSqm" label={t("plotSizeSqmLabel")} defaultValue={draft.plotSizeSqm} />
        </div>

        {/* Agents are asked only the asking price. The starting price is set from it
            once, when the property is created, and never changes after that. */}
        <NumField id="askingPrice" label={t("askingPriceLabel")} required defaultValue={draft.askingPrice} />

        <SelectField
          id="condition"
          label={t("conditionLabel")}
          required
          options={CONDITIONS}
          value={draft.condition}
          placeholder={t("selectPlaceholder")}
        />

        <div className="grid grid-cols-2 gap-2">
          <SelectField id="elevator" label={t("elevatorLabel")} required options={ELEVATOR} value={draft.elevator} placeholder={t("selectPlaceholder")} />
          <SelectField id="ac" label={t("acLabel")} required options={AIR_CONDITIONING} value={draft.ac} placeholder={t("selectPlaceholder")} />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-2">
            <SelectField id="balcony" label={t("balconyLabel")} required options={BALCONY} value={draft.balcony} placeholder={t("selectPlaceholder")} />
            <NumField id="balconySizeSqm" label={t("balconySizeLabel")} defaultValue={draft.balconySizeSqm} />
          </div>
          <div className="flex flex-col gap-2">
            <SelectField id="garden" label={t("gardenLabel")} options={YES_NO} value={draft.garden} placeholder={t("selectPlaceholder")} />
            <NumField id="gardenSizeSqm" label={t("gardenSizeLabel")} defaultValue={draft.gardenSizeSqm} />
          </div>
          <div className="flex flex-col gap-2">
            <SelectField id="parking" label={t("parkingLabel")} required options={PARKING} value={draft.parking} placeholder={t("selectPlaceholder")} />
            <NumField id="parkingCount" label={t("parkingCountLabel")} defaultValue={draft.parkingCount} />
          </div>
          <div className="flex flex-col gap-2">
            <SelectField id="storage" label={t("storageLabel")} required options={YES_NO} value={draft.storage} placeholder={t("selectPlaceholder")} />
            <NumField id="storageSizeSqm" label={t("storageSizeLabel")} defaultValue={draft.storageSizeSqm} />
          </div>
        </div>

        <SelectField id="safeRoom" label={t("safeRoomLabel")} required options={YES_NO} value={draft.safeRoom} placeholder={t("selectPlaceholder")} />

        <fieldset className="flex flex-col gap-2 rounded-md border p-3">
          <legend className="px-1 text-sm font-medium">{t("additionalFeaturesLabel")}</legend>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {ADDITIONAL_FEATURES.map((f) => (
              <label key={f} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="additionalFeatures" value={f} defaultChecked={selected.has(f)} className="h-4 w-4" />
                {f}
              </label>
            ))}
          </div>
        </fieldset>

        <Button type="submit" size="lg">
          {common("continue")}
        </Button>
      </form>
    </PropertyWizardChrome>
  );
}

function NumField({
  id,
  label,
  required,
  defaultValue,
}: {
  id: string;
  label: string;
  required?: boolean;
  defaultValue?: number;
}) {
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
        type="number"
        inputMode="decimal"
        dir="ltr"
        defaultValue={defaultValue?.toString() ?? ""}
      />
    </div>
  );
}

function SelectField({
  id,
  label,
  required,
  options,
  value,
  placeholder,
}: {
  id: string;
  label: string;
  required?: boolean;
  options: readonly string[];
  value?: string;
  placeholder: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-primary"> *</span>}
      </Label>
      <select id={id} name={id} required={required} defaultValue={value ?? ""} dir="rtl" className={SELECT_CLASS}>
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}
