"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { PropertyContractSummary } from "@/lib/wizard/monday";
import { PROPERTY_WIZARD_FORM_ID } from "@/lib/property-wizard/steps";
import { submitContractPick } from "./actions";

interface Props {
  contracts: PropertyContractSummary[];
  initialSelectedId?: string;
  initialContractType?: string;
}

/** Same picker/manual-toggle UI pattern as the deal wizard's PropertyForm
 *  (src/app/deals/new/(wizard)/property/property-form.tsx), with an added
 *  first choice per Levi's confirmed UX: is this listing exclusive
 *  (biladiut) or not (haskama only)? That choice filters which contracts
 *  show up — picking a biladiut one auto-carries its linked haskama's
 *  commission (see listSellersForPropertyWizard's merge logic); commission
 *  always comes from the haskama row regardless of which bucket is picked. */
export function ContractPickForm({ contracts, initialSelectedId, initialContractType }: Props) {
  const t = useTranslations("ContractPickStep");
  const common = useTranslations("Common");
  const [contractType, setContractType] = useState<"biladiut" | "haskama" | "">(
    initialContractType === "biladiut" || initialContractType === "haskama"
      ? initialContractType
      : "",
  );
  const [mode, setMode] = useState<"picker" | "manual">("picker");
  const [selectedId, setSelectedId] = useState(initialSelectedId ?? "");
  const [search, setSearch] = useState("");

  const bucketed = useMemo(
    () =>
      contractType === "biladiut"
        ? contracts.filter((c) => c.hasExclusivity)
        : contractType === "haskama"
          ? contracts.filter((c) => !c.hasExclusivity)
          : [],
    [contracts, contractType],
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return bucketed;
    const q = search.trim().toLowerCase();
    return bucketed.filter(
      (c) => c.name.toLowerCase().includes(q) || c.propertyAddress?.toLowerCase().includes(q),
    );
  }, [bucketed, search]);

  if (!contractType) {
    return (
      <div className="flex flex-col gap-6">
        <p className="text-sm text-muted-foreground">{t("contractTypePrompt")}</p>
        <div className="flex flex-col gap-3">
          {(["biladiut", "haskama"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setContractType(v)}
              className="flex flex-col items-stretch gap-1 rounded-lg border-2 border-input p-5 text-center transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="text-lg font-semibold">
                {v === "biladiut" ? t("contractTypeBiladiut") : t("contractTypeHaskama")}
              </span>
              <span className="text-sm text-muted-foreground">
                {v === "biladiut" ? t("contractTypeBiladiutHint") : t("contractTypeHaskamaHint")}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <form id={PROPERTY_WIZARD_FORM_ID} action={submitContractPick} className="flex flex-col gap-5">
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="contractType" value={contractType} />

      <button
        type="button"
        onClick={() => setContractType("")}
        className="self-start text-sm text-secondary underline-offset-4 hover:underline"
      >
        {contractType === "biladiut" ? t("contractTypeBiladiut") : t("contractTypeHaskama")} · {t("changeContractType")}
      </button>

      {mode === "picker" && (
        <div className="flex flex-col gap-3">
          <Label htmlFor="contract-search">{t("pickerLabel")}</Label>
          {bucketed.length === 0 ? (
            <Alert>
              <AlertDescription>{t("noContracts")}</AlertDescription>
            </Alert>
          ) : (
            <>
              <Input
                id="contract-search"
                type="search"
                placeholder={t("searchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                dir="rtl"
              />
              {filtered.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t("noMatches")}</p>
              ) : (
                <ul className="max-h-72 overflow-y-auto divide-y rounded-md border text-sm">
                  {filtered.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(c.id)}
                        className={[
                          "flex w-full flex-col gap-0.5 px-3 py-2 text-right hover:bg-muted/40",
                          selectedId === c.id ? "border-e-2 border-primary bg-primary/5" : "",
                        ].join(" ")}
                      >
                        <span className="font-medium">{c.name}</span>
                        {c.propertyAddress && (
                          <span className="text-xs text-muted-foreground">{c.propertyAddress}</span>
                        )}
                        {c.exclusivityEndDate && (
                          <span className="text-xs text-primary">
                            {t("exclusiveUntil", { date: c.exclusivityEndDate })}
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
        <div className="flex flex-col gap-3">
          <Alert>
            <AlertDescription>{t("manualNotice")}</AlertDescription>
          </Alert>
          {bucketed.length > 0 && (
            <button
              type="button"
              onClick={() => setMode("picker")}
              className="self-start text-sm text-secondary underline-offset-4 hover:underline"
            >
              {t("backToList")}
            </button>
          )}
        </div>
      )}

      <Button type="submit" size="lg" disabled={mode === "picker" && !selectedId && bucketed.length > 0}>
        {common("continue")}
      </Button>
    </form>
  );
}
