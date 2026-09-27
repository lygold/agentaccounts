"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import type { DocLanguage } from "@/lib/types";
import { createOfferRequest } from "./actions";

interface PropertyOption {
  id: string;
  address: string;
  ownerName: string;
}

export function OfferNewForm({ properties }: { properties: PropertyOption[] }) {
  const t = useTranslations("OfferNew");
  const common = useTranslations("Common");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<PropertyOption | null>(null);
  const [manualEntry, setManualEntry] = useState(false);
  const [address, setAddress] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [language, setLanguage] = useState<DocLanguage>("hebrew");
  const [withLogo, setWithLogo] = useState(true);

  const filtered = useMemo(() => {
    if (!search.trim()) return properties;
    const q = search.trim().toLowerCase();
    return properties.filter(
      (p) => p.address.toLowerCase().includes(q) || p.ownerName.toLowerCase().includes(q),
    );
  }, [properties, search]);

  function pick(p: PropertyOption) {
    setSelected(p);
    setManualEntry(false);
    setAddress(p.address);
    setOwnerName(p.ownerName);
  }

  function pickManualEntry() {
    setSelected(null);
    setManualEntry(true);
    setAddress("");
    setOwnerName("");
  }

  return (
    <form action={createOfferRequest} className="flex flex-col gap-5">
      <input type="hidden" name="propertyId" value={selected?.id ?? ""} />

      {properties.length === 0 ? (
        <Alert>
          <AlertDescription>{t("noProperties")}</AlertDescription>
        </Alert>
      ) : (
        <div className="flex flex-col gap-3">
          <Label htmlFor="property-search">{t("pickerLabel")}</Label>
          <Input
            id="property-search"
            type="search"
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            dir="rtl"
          />
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("noMatches")}</p>
          ) : (
            <ul className="max-h-64 overflow-y-auto divide-y rounded-md border text-sm">
              {filtered.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => pick(p)}
                    className={cn(
                      "flex w-full flex-col gap-0.5 px-3 py-2 text-right hover:bg-muted/40",
                      selected?.id === p.id ? "border-e-2 border-primary bg-primary/5" : "",
                    )}
                  >
                    <span className="font-medium">{p.address}</span>
                    {p.ownerName && <span className="text-xs text-muted-foreground">{p.ownerName}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!manualEntry && (
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={pickManualEntry}
            className="self-start text-sm text-secondary underline-offset-4 hover:underline"
          >
            {t("propertyNotListed")}
          </button>
          <p className="text-xs text-muted-foreground">{t("propertyNotListedWarning")}</p>
        </div>
      )}

      {(selected || manualEntry) && (
        <>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="propertyAddress">{t("addressLabel")}</Label>
            <Input
              id="propertyAddress"
              name="propertyAddress"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              dir="rtl"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ownerName">{t("ownerLabel")}</Label>
            <Input
              id="ownerName"
              name="ownerName"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              dir="rtl"
            />
          </div>

          <ToggleGroup
            label={t("languageLabel")}
            value={language}
            onChange={setLanguage}
            options={[
              { value: "hebrew", label: common("hebrew") },
              { value: "english", label: common("english") },
            ]}
          />
          <input type="hidden" name="language" value={language} />

          <ToggleGroup
            label={t("logoLabel")}
            value={withLogo ? "with" : "without"}
            onChange={(v) => setWithLogo(v === "with")}
            options={[
              { value: "with", label: t("withLogo") },
              { value: "without", label: t("withoutLogo") },
            ]}
          />
          <input type="hidden" name="withLogo" value={withLogo ? "true" : "false"} />

          <Button type="submit" size="lg" disabled={!address.trim() || !ownerName.trim()}>
            {t("submit")}
          </Button>
        </>
      )}
    </form>
  );
}

function ToggleGroup<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <div className="flex gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex-1 rounded-md border-2 px-3 py-2 text-sm transition-colors hover:bg-muted/50",
              value === opt.value ? "border-primary bg-primary/5" : "border-input",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
