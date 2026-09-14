"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PartyInput } from "@/lib/wizard/draft";
import { WizardSubmitButton } from "@/components/wizard-submit-button";
import { WIZARD_FORM_ID } from "@/lib/wizard/steps";
import { PhoneInput } from "@/components/phone-input";

/** Minimal colleague shape for the owner-agent/buyer-agent picker — sourced
 *  from agentLedger's own `agents` table (listAgentsByOffice) as of Phase 8,
 *  not sikkumPigisha's Daf Kesher `Agent` type. Same three fields either
 *  way, so the picker UI below (ported unchanged) doesn't care. */
export interface WizardAgentOption {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
}

interface PartyFormProps {
  action: (formData: FormData) => void;
  initial?: PartyInput;
  /** "name required" markers vs. just informational fields. */
  nameRequired: boolean;
  /** True when the spec says phone OR email is required (lawyers + agents
   *  when this is the represented side). False on the opposite-side party
   *  pages where everything is advisory. */
  contactRequired: boolean;
  /** Localized intro line — page-specific, so callers pass it via t(). */
  intro?: string;
  /** When non-empty, show a picker to select a colleague from the agents
   *  board instead of typing name/phone/email by hand — used on owner-agent
   *  /buyer-agent when the other side is confirmed to be a colleague. */
  agentOptions?: WizardAgentOption[];
}

/**
 * 3-field party form (name + phone + email) used by both lawyer pages and
 * (when no auto-fill applies) agent pages. The "phone OR email" rule is
 * enforced on submit by the page's server action — the UI just marks both
 * with stars when applicable.
 *
 * Ported from sikkumPigisha's party-form.tsx — unchanged except the
 * agentOptions type (own agents table instead of a Daf Kesher lookup).
 */
export function PartyForm({
  action,
  initial,
  nameRequired,
  contactRequired,
  intro,
  agentOptions,
}: PartyFormProps) {
  const t = useTranslations("PartyForm");
  const common = useTranslations("Common");
  const hasAgentOptions = (agentOptions?.length ?? 0) > 0;
  const [mode, setMode] = useState<"picker" | "manual">(
    hasAgentOptions && !initial?.name ? "picker" : "manual",
  );
  const [search, setSearch] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<WizardAgentOption | null>(null);

  const filteredAgents = useMemo(() => {
    if (!agentOptions) return [];
    const q = search.trim().toLowerCase();
    if (!q) return agentOptions;
    return agentOptions.filter((a) => a.name.toLowerCase().includes(q));
  }, [agentOptions, search]);

  return (
    <form id={WIZARD_FORM_ID} action={action} className="flex flex-col gap-5">
      {intro && (
        <p className="text-sm text-muted-foreground">{intro}</p>
      )}

      {hasAgentOptions && mode === "picker" ? (
        <div className="flex flex-col gap-3">
          <Label htmlFor="agent-search">{t("pickAgent")}</Label>
          <Input
            id="agent-search"
            type="search"
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            dir="rtl"
          />
          {filteredAgents.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {t("noAgentsFound")}
            </p>
          ) : (
            <ul className="max-h-64 overflow-y-auto divide-y rounded-md border text-sm">
              {filteredAgents.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedAgent(a)}
                    className={[
                      "flex w-full flex-col gap-0.5 px-3 py-2 text-right hover:bg-muted/40",
                      selectedAgent?.id === a.id
                        ? "border-e-2 border-primary bg-primary/5"
                        : "",
                    ].join(" ")}
                  >
                    <span className="font-medium">{a.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <input type="hidden" name="name" value={selectedAgent?.name ?? ""} />
          <input type="hidden" name="phone" value={selectedAgent?.phone ?? ""} />
          <input type="hidden" name="email" value={selectedAgent?.email ?? ""} />
          <button
            type="button"
            onClick={() => setMode("manual")}
            className="self-start text-sm text-secondary underline-offset-4 hover:underline"
          >
            {t("agentNotListed")}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {hasAgentOptions && (
            <button
              type="button"
              onClick={() => setMode("picker")}
              className="self-start text-sm text-secondary underline-offset-4 hover:underline"
            >
              {t("backToList")}
            </button>
          )}
          <Field
            id="name"
            label={common("nameLabel")}
            required={nameRequired}
            defaultValue={initial?.name}
          />
          <PhoneInput
            id="phone"
            label={common("phoneLabel")}
            required={contactRequired}
            requiredHint={contactRequired ? t("contactRequiredHint") : undefined}
            defaultValue={initial?.phone}
          />
          <Field
            id="email"
            label={common("emailLabel")}
            type="email"
            required={contactRequired}
            defaultValue={initial?.email}
            contactHint={contactRequired ? t("contactRequiredHint") : undefined}
          />
          {contactRequired && (
            <p className="text-xs text-muted-foreground">
              {t("contactNotePrefix")} <em>{t("contactNoteOr")}</em>{" "}
              {t("contactNoteSuffix")}
            </p>
          )}
        </div>
      )}

      <WizardSubmitButton disabled={hasAgentOptions && mode === "picker" && !selectedAgent} />
      <p className="text-xs text-muted-foreground">
        {common("requiredNotePrefix")} <span className="text-primary">*</span>{" "}
        {common("requiredNoteSuffix")}
      </p>
    </form>
  );
}

function Field({
  id,
  label,
  type = "text",
  inputMode,
  required,
  defaultValue,
  contactHint,
}: {
  id: string;
  label: string;
  type?: string;
  inputMode?: "text" | "numeric" | "tel" | "email";
  required?: boolean;
  defaultValue?: string;
  contactHint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {label}
        {required && (
          <span className="text-primary">
            {" *"}
            {contactHint && (
              <span className="ms-1 text-xs font-normal text-muted-foreground">
                {contactHint}
              </span>
            )}
          </span>
        )}
      </Label>
      <Input
        id={id}
        name={id}
        type={type}
        inputMode={inputMode}
        defaultValue={defaultValue ?? ""}
        dir={type === "email" || inputMode === "tel" ? "ltr" : undefined}
      />
    </div>
  );
}
