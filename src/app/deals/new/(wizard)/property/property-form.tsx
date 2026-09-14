"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DidYouMeanPrompt } from "@/components/did-you-mean";
import type { PropertySummary } from "@/lib/wizard/monday";
import type { PropertyInput } from "@/lib/wizard/draft";
import { WIZARD_FORM_ID } from "@/lib/wizard/steps";
import { findMatchingProperty } from "@/lib/wizard/property-match";
import { submitProperty } from "./actions";

interface Props {
  properties: PropertySummary[];
  /** True when the agent represents owner or both — show the picker. */
  hasListings: boolean;
  /** Existing draft value, for prefill on revisit. */
  initial?: PropertyInput;
}

/**
 * Property step: pick from your Monday listings (if you represent owner/both)
 * OR enter manually (always available via the "doesn't appear" toggle).
 * Selecting a listing prefills the manual fields — agent can still edit.
 */
export function PropertyForm({ properties, hasListings, initial }: Props) {
  const t = useTranslations("PropertyStep");
  const common = useTranslations("Common");
  const initialMode: "picker" | "manual" =
    !hasListings || initial?.selectedItemId === null ? "manual" : "picker";
  const [mode, setMode] = useState<"picker" | "manual">(initialMode);
  const [selectedId, setSelectedId] = useState<string>(
    initial?.selectedItemId ?? "",
  );
  const [search, setSearch] = useState("");

  const filteredProperties = useMemo(() => {
    if (!search.trim()) return properties;
    const q = search.trim().toLowerCase();
    return properties.filter(
      (p) =>
        p.label.toLowerCase().includes(q) ||
        p.ownerName?.toLowerCase().includes(q),
    );
  }, [properties, search]);

  // "Did you mean" only applies while manually typing — if the agent already
  // has this address as one of their own listings, skip re-entering price/
  // owner/lawyer details by hand: hand off to the exact same picker-submit
  // path that already fetches and prefills all of that server-side.
  const [manualStreet, setManualStreet] = useState(initial?.street ?? "");
  const [manualBuilding, setManualBuilding] = useState(
    initial?.buildingNumber ?? "",
  );
  const [dismissedMatchId, setDismissedMatchId] = useState<string | null>(
    null,
  );
  const matchedProperty = useMemo(() => {
    const match = findMatchingProperty(properties, manualStreet, manualBuilding);
    if (!match || match.id === dismissedMatchId) return null;
    return match;
  }, [properties, manualStreet, manualBuilding, dismissedMatchId]);

  return (
    <form id={WIZARD_FORM_ID} action={submitProperty} className="flex flex-col gap-5">
      <input type="hidden" name="mode" value={mode} />

      {mode === "picker" && hasListings && (
        <div className="flex flex-col gap-3">
          <Label htmlFor="property-search">{t("pickerLabel")}</Label>
          {properties.length === 0 ? (
            <Alert>
              <AlertDescription>{t("noProperties")}</AlertDescription>
            </Alert>
          ) : (
            <>
              <Input
                id="property-search"
                type="search"
                placeholder={t("searchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                dir="rtl"
              />
              {filteredProperties.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {t("noMatches")}
                </p>
              ) : (
                <ul className="max-h-64 overflow-y-auto divide-y rounded-md border text-sm">
                  {filteredProperties.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(p.id)}
                        className={[
                          "flex w-full flex-col gap-0.5 px-3 py-2 text-right hover:bg-muted/40",
                          selectedId === p.id
                            ? "border-e-2 border-primary bg-primary/5"
                            : "",
                        ].join(" ")}
                      >
                        <span className="font-medium">{p.label}</span>
                        {p.ownerName && (
                          <span className="text-xs text-muted-foreground">
                            {p.ownerName}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <input type="hidden" name="selectedItemId" value={selectedId} />
            </>
          )}
          <button
            type="button"
            onClick={() => setMode("manual")}
            className="self-start text-sm text-secondary underline-offset-4 hover:underline"
          >
            {t("notListed")}
          </button>
        </div>
      )}

      {mode === "manual" && (
        <div className="flex flex-col gap-4">
          {hasListings && (
            <button
              type="button"
              onClick={() => setMode("picker")}
              className="self-start text-sm text-secondary underline-offset-4 hover:underline"
            >
              {t("backToList")}
            </button>
          )}

          <ManualField
            id="neighbourhood"
            label={t("neighbourhoodLabel")}
            required
            defaultValue={initial?.neighbourhood}
          />
          <div className="grid grid-cols-2 gap-4">
            <ManualField
              id="street"
              label={t("streetLabel")}
              required
              value={manualStreet}
              onChange={setManualStreet}
            />
            <ManualField
              id="buildingNumber"
              label={t("buildingNumberLabel")}
              required
              value={manualBuilding}
              onChange={setManualBuilding}
            />
          </div>

          {matchedProperty && (
            <DidYouMeanPrompt
              label={
                matchedProperty.label +
                (matchedProperty.ownerName
                  ? ` — ${matchedProperty.ownerName}`
                  : "")
              }
              onConfirm={() => {
                // Submit straight through the same server action the picker
                // itself uses (mode=picker), instead of just switching into
                // picker view and leaving the agent to hit Continue again —
                // confirming should behave exactly like having picked it.
                const fd = new FormData();
                fd.set("mode", "picker");
                fd.set("selectedItemId", matchedProperty.id);
                submitProperty(fd);
              }}
              onDismiss={() => setDismissedMatchId(matchedProperty.id)}
            />
          )}

          <div className="grid grid-cols-2 gap-4">
            <ManualField
              id="apartmentNumber"
              label={t("apartmentNumberLabel")}
              required
              defaultValue={initial?.apartmentNumber}
            />
            <ManualField
              id="gushChelka"
              label={t("gushChelkaLabel")}
              defaultValue={initial?.gushChelka}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <ManualField
              id="rooms"
              label={t("roomsLabel")}
              type="number"
              defaultValue={initial?.rooms?.toString()}
            />
            <ManualField
              id="sizeSqm"
              label={t("sizeSqmLabel")}
              type="number"
              defaultValue={initial?.sizeSqm?.toString()}
            />
          </div>
        </div>
      )}

      <Button type="submit" size="lg">
        {common("continue")}
      </Button>
      <p className="text-xs text-muted-foreground">
        {common("requiredNotePrefix")} <span className="text-primary">*</span>{" "}
        {t("requiredNoteSuffix")}
      </p>
    </form>
  );
}

function ManualField({
  id,
  label,
  required,
  type = "text",
  defaultValue,
  value,
  onChange,
}: {
  id: string;
  label: string;
  required?: boolean;
  type?: string;
  defaultValue?: string;
  /** Controlled mode (needed for street/buildingNumber to drive "did you
   *  mean" matching) — pass value+onChange instead of defaultValue. */
  value?: string;
  onChange?: (v: string) => void;
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
        type={type}
        inputMode={type === "number" ? "numeric" : undefined}
        {...(controlled
          ? { value, onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange?.(e.target.value) }
          : { defaultValue: defaultValue ?? "" })}
      />
    </div>
  );
}
