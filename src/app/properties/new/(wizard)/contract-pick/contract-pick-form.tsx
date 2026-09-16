"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { ClientCommissionSummary } from "@/lib/wizard/monday/types";
import { PROPERTY_WIZARD_FORM_ID } from "@/lib/property-wizard/steps";
import { submitContractPick } from "./actions";

interface Props {
  contracts: ClientCommissionSummary[];
  initialSelectedId?: string;
}

/** Same picker/manual-toggle UI pattern as the deal wizard's PropertyForm
 *  (src/app/deals/new/(wizard)/property/property-form.tsx). */
export function ContractPickForm({ contracts, initialSelectedId }: Props) {
  const t = useTranslations("ContractPickStep");
  const common = useTranslations("Common");
  const [mode, setMode] = useState<"picker" | "manual">(
    contracts.length > 0 ? "picker" : "manual",
  );
  const [selectedId, setSelectedId] = useState(initialSelectedId ?? "");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return contracts;
    const q = search.trim().toLowerCase();
    return contracts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.propertyAddress?.toLowerCase().includes(q),
    );
  }, [contracts, search]);

  return (
    <form id={PROPERTY_WIZARD_FORM_ID} action={submitContractPick} className="flex flex-col gap-5">
      <input type="hidden" name="mode" value={mode} />

      {mode === "picker" && (
        <div className="flex flex-col gap-3">
          <Label htmlFor="contract-search">{t("pickerLabel")}</Label>
          {contracts.length === 0 ? (
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
          {contracts.length > 0 && (
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

      <Button type="submit" size="lg" disabled={mode === "picker" && !selectedId && contracts.length > 0}>
        {common("continue")}
      </Button>
    </form>
  );
}
