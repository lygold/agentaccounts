"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import type { AgentRecord } from "@/lib/types";
import { submitNewReferral } from "./actions";

const DIRECTIONS = ["outgoing", "outgoing_internal", "incoming", "incoming_internal"] as const;
const CLIENT_TYPES = ["seller", "buyer", "landlord"] as const;

export function NewReferralForm({ agents }: { agents: AgentRecord[] }) {
  const t = useTranslations("ReferralNew");
  const tDirection = useTranslations("ReferralNew.direction");
  const tClientType = useTranslations("ReferralNew.clientType");
  const [direction, setDirection] = useState<(typeof DIRECTIONS)[number]>("outgoing");
  const isIncoming = direction === "incoming" || direction === "incoming_internal";

  const agentOptions = useMemo(
    () => agents.map((a) => ({ value: a.id, label: a.name })),
    [agents],
  );

  return (
    <form action={submitNewReferral} className="flex flex-col gap-5">
      <Section title={t("directionLabel")}>
        <select
          id="direction"
          name="direction"
          value={direction}
          onChange={(e) => setDirection(e.target.value as (typeof DIRECTIONS)[number])}
          className="h-11 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {DIRECTIONS.map((d) => (
            <option key={d} value={d}>
              {tDirection(d)}
            </option>
          ))}
        </select>
        {isIncoming && <p className="text-xs text-muted-foreground">{t("incomingNote")}</p>}
      </Section>

      <Section title={t("receivingAgentLabel")}>
        <SearchableSelect
          rtl
          id="receivingAgentId"
          name="receivingAgentId"
          options={agentOptions}
          placeholder={t("selectPlaceholder")}
          emptyLabel={t("selectPlaceholder")}
          required
        />
      </Section>

      <Section title={t("clientTitle")}>
        <Field id="clientName" label={t("clientNameLabel")} required />
        <div className="grid grid-cols-2 gap-4">
          <Field id="clientPhone" label={t("clientPhoneLabel")} dir="ltr" />
          <Field id="clientEmail" label={t("clientEmailLabel")} dir="ltr" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="clientType">{t("clientTypeLabel")}</Label>
          <select
            id="clientType"
            name="clientType"
            defaultValue=""
            className="h-11 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">{t("selectPlaceholder")}</option>
            {CLIENT_TYPES.map((v) => (
              <option key={v} value={v}>
                {tClientType(v)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="notes">{t("notesLabel")}</Label>
          <Textarea id="notes" name="notes" dir="rtl" rows={3} />
        </div>
      </Section>

      <Button type="submit" size="lg">
        {t("submit")}
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
  dir,
  required,
}: {
  id: string;
  label: string;
  dir?: "ltr" | "rtl";
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={id} dir={dir ?? "rtl"} required={required} />
    </div>
  );
}
