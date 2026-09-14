"use client";

import { useState, useMemo, useEffect, useActionState } from "react";
import { useTranslations } from "next-intl";
import { Plus, X, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PhoneInput } from "@/components/phone-input";
import { DidYouMeanPrompt } from "@/components/did-you-mean";
import { PersonSuggestions, type PersonSuggestion } from "@/components/person-suggestions";
import type { CommunicationLang, PersonInput } from "@/lib/wizard/draft";
import type { ClientSummary } from "@/lib/wizard/monday";
import type { WizardActionResult } from "@/lib/wizard/action-utils";
import { WIZARD_FORM_ID } from "@/lib/wizard/steps";

interface PersonsFormProps {
  side: "owner" | "buyer";
  /** Server action wired by the page — must accept (prev, formData) for useActionState. */
  action: (prev: WizardActionResult, formData: FormData) => Promise<WizardActionResult>;
  /** Initial array of persons (prefill on revisit, or seeded by upstream page). */
  initial?: PersonInput[];
  /** "name only required" if represent === the OTHER side. Full set otherwise. */
  requireAllFields: boolean;
  /** Initial side-level communication-language. */
  initialCommunicationLang?: CommunicationLang;
  /** Show the communication-language picker only when the agent represents
   *  this side. If false, the picker is hidden and no value is submitted. */
  showCommunicationLang?: boolean;
  /** Existing clients from the contracts board — shown in picker for buyer side. */
  availableClients?: ClientSummary[];
  /** Property street + building from the draft — used to pre-filter the list. */
  propertyAddressHint?: string;
  /** Suggestions from the Offers board / Signed Contracts, computed
   *  server-side by fuzzy-matching the deal's property. Shown as an overlay
   *  above everything else, before any field is filled in. */
  suggestions?: PersonSuggestion[];
  /** Heading text for the suggestions overlay — side-specific ("קונים" vs
   *  "בעלים"). Required whenever `suggestions` is passed. */
  suggestionsTitle?: string;
  /** Shown under person #1's teudat-zehut field when it was silently
   *  backfilled server-side (e.g. from a matching Signed Contracts record) —
   *  lets the agent see it wasn't something they forgot to fill in. */
  teudatZehutAutofillNotice?: string;
  /** Previously-selected offer id (prefill on revisit) — without this, going
   *  back to edit a field after picking an offer suggestion and continuing
   *  again would silently drop it, since local picker state doesn't survive
   *  a remount. */
  initialSelectedOfferId?: string | null;
  /** Side-specific Hebrew labels (single-person title, communication-lang prompt). */
  labels: {
    singleTitle: string;
    addAnother: string;
    capNote: string;
    commLangPrompt: string;
  };
}

/**
 * Multi-person form used by both /form/owners and /form/buyers. Hard cap at 2
 * for v1; "more than 2 → email Levi" guidance baked into capNote.
 *
 * Field names use array-index notation (persons[0].name, persons[1].name,
 * communicationLang) which the server action's zod schema parses back into
 * an array.
 */
export function PersonsForm({
  action,
  initial,
  requireAllFields,
  initialCommunicationLang,
  showCommunicationLang = true,
  availableClients,
  propertyAddressHint,
  suggestions,
  suggestionsTitle,
  teudatZehutAutofillNotice,
  initialSelectedOfferId,
  labels,
}: PersonsFormProps) {
  const t = useTranslations("PersonsForm");
  const common = useTranslations("Common");
  const [state, formAction, isPending] = useActionState(action, undefined);
  const [showSpinner, setShowSpinner] = useState(false);
  const [slowNotice, setSlowNotice] = useState(false);

  useEffect(() => {
    if (!isPending) {
      setShowSpinner(false);
      setSlowNotice(false);
      return;
    }
    const t1 = setTimeout(() => setShowSpinner(true), 1000);
    const t2 = setTimeout(() => setSlowNotice(true), 5000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [isPending]);

  const seed = initial && initial.length > 0 ? initial : [{ name: "" }];
  const [persons, setPersons] = useState<PersonInput[]>(seed);
  const [search, setSearch] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(
    initialSelectedOfferId ?? null,
  );

  const [suggestionsDismissed, setSuggestionsDismissed] = useState(false);

  const showPicker = availableClients && availableClients.length > 0;
  const showEmptyState = availableClients && availableClients.length === 0;

  // Filter clients: prefer those whose propertyAddress matches the hint,
  // then apply free-text name search on top.
  const filteredClients = useMemo(() => {
    if (!availableClients) return [];
    let list = availableClients;
    // Pre-sort: clients whose property address contains the hint come first.
    if (propertyAddressHint) {
      const hint = propertyAddressHint.toLowerCase();
      list = [
        ...list.filter((c) =>
          c.propertyAddress?.toLowerCase().includes(hint),
        ),
        ...list.filter(
          (c) => !c.propertyAddress?.toLowerCase().includes(hint),
        ),
      ];
    }
    // Apply free-text search on name.
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q));
    }
    return list;
  }, [availableClients, propertyAddressHint, search]);

  // Bumped per-index whenever a person's fields get programmatically filled
  // (picker selection or a confirmed "did you mean" match) so PhoneInput
  // below — which manages its own state internally — knows to re-seed from
  // the new value instead of keeping whatever was typed before.
  const [applyVersion, setApplyVersion] = useState<Record<number, number>>({});

  function applyClient(client: ClientSummary, index = 0) {
    if (index === 0) setSelectedClientId(client.id);
    setPersons((prev) => {
      const updated = [...prev];
      updated[index] = {
        name: client.name,
        phone: client.phone ?? undefined,
        email: client.email ?? undefined,
        teudatZehut: client.idNumber ?? undefined,
      };
      return updated;
    });
    setApplyVersion((prev) => ({ ...prev, [index]: (prev[index] ?? 0) + 1 }));
  }

  function applySuggestion(s: PersonSuggestion) {
    if (s.source === "signed-contract" && s.clientId) {
      setSelectedClientId(s.clientId);
    }
    if (s.source === "offer" && s.offerId) {
      setSelectedOfferId(s.offerId);
    }
    const updated: PersonInput[] = [
      {
        name: s.person1.name,
        teudatZehut: s.person1.idNumber ?? undefined,
        phone: s.person1.phone ?? undefined,
        email: s.person1.email ?? undefined,
      },
    ];
    if (s.person2) {
      updated.push({ name: s.person2.name, teudatZehut: s.person2.idNumber ?? undefined });
    }
    setPersons(updated);
    setApplyVersion((prev) => ({
      ...prev,
      0: (prev[0] ?? 0) + 1,
      1: (prev[1] ?? 0) + 1,
    }));
    setSuggestionsDismissed(true);
  }

  // "Did you mean" for manually-typed names: the picker above only ever
  // fills person #1, so this is the only shortcut for person #2 today. Only
  // fires while phone/email are still empty — once filled in (by hand or via
  // the picker) the agent has clearly moved past needing the suggestion.
  const [dismissedNameMatches, setDismissedNameMatches] = useState<
    Record<number, string>
  >({});
  const nameMatches = useMemo(() => {
    if (!availableClients) return {} as Record<number, ClientSummary>;
    const result: Record<number, ClientSummary> = {};
    persons.forEach((p, i) => {
      const name = p.name.trim().toLowerCase();
      if (name.length < 2 || p.phone || p.email) return;
      const match = availableClients.find(
        (c) => c.name.trim().toLowerCase() === name,
      );
      if (!match) return;
      if (dismissedNameMatches[i] === match.id) return;
      if (i === 0 && selectedClientId === match.id) return;
      result[i] = match;
    });
    return result;
  }, [persons, availableClients, dismissedNameMatches, selectedClientId]);

  const canAdd = persons.length < 2;

  return (
    <form id={WIZARD_FORM_ID} action={formAction} className="flex flex-col gap-6">

      {suggestions && suggestionsTitle && !suggestionsDismissed && (
        <PersonSuggestions
          title={suggestionsTitle}
          suggestions={suggestions}
          onSelect={applySuggestion}
          onDismiss={() => setSuggestionsDismissed(true)}
        />
      )}

      {showPicker && (
        <div className="flex flex-col gap-2 rounded-lg border p-4">
          <p className="text-sm font-semibold">{t("pickerTitle")}</p>
          {propertyAddressHint && (
            <p className="text-xs text-muted-foreground">
              {t("pickerHint", { address: propertyAddressHint })}
            </p>
          )}
          <Input
            type="search"
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 text-sm"
            dir="rtl"
          />
          {filteredClients.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("noClientsFound")}</p>
          ) : (
            <ul className="max-h-48 overflow-y-auto divide-y rounded-md border text-sm">
              {filteredClients.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => applyClient(c)}
                    className="w-full px-3 py-2 text-right hover:bg-muted/40 flex flex-col gap-0.5"
                  >
                    <span className="font-medium">{c.name}</span>
                    {c.propertyAddress && (
                      <span className="text-xs text-muted-foreground">
                        {c.propertyAddress}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">{t("pickerFootnote")}</p>
        </div>
      )}

      {showEmptyState && (
        <p className="text-xs text-muted-foreground">{t("emptyState")}</p>
      )}

      {persons.map((p, i) => (
        <fieldset
          key={i}
          className="flex flex-col gap-3 rounded-lg border p-4"
        >
          <legend className="px-1 text-sm font-semibold">
            {persons.length === 1
              ? labels.singleTitle
              : `${labels.singleTitle} #${i + 1}`}
            {i === 1 && (
              <button
                type="button"
                onClick={() =>
                  setPersons((prev) => prev.filter((_, idx) => idx !== i))
                }
                className="ms-2 inline-flex items-center text-muted-foreground hover:text-destructive"
                aria-label={t("removeAria")}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </legend>

          <Field
            id={`persons.${i}.name`}
            label={common("nameLabel")}
            required
            value={p.name}
            onChange={(v) =>
              setPersons((prev) =>
                prev.map((x, idx) => (idx === i ? { ...x, name: v } : x)),
              )
            }
          />
          {nameMatches[i] && (
            <DidYouMeanPrompt
              label={
                [nameMatches[i].name, nameMatches[i].propertyAddress]
                  .filter(Boolean)
                  .join(" — ")
              }
              onConfirm={() => applyClient(nameMatches[i], i)}
              onDismiss={() =>
                setDismissedNameMatches((prev) => ({
                  ...prev,
                  [i]: nameMatches[i].id,
                }))
              }
            />
          )}
          <Field
            id={`persons.${i}.teudatZehut`}
            label={common("teudatZehutLabel")}
            inputMode="numeric"
            required={requireAllFields && i === 0}
            value={p.teudatZehut ?? ""}
            onChange={(v) => {
              const digitsOnly = v.replace(/\D/g, "");
              setPersons((prev) =>
                prev.map((x, idx) =>
                  idx === i ? { ...x, teudatZehut: digitsOnly } : x,
                ),
              );
            }}
          />
          {i === 0 && teudatZehutAutofillNotice && (
            <p className="text-xs text-primary">{teudatZehutAutofillNotice}</p>
          )}
          <p className="text-xs text-muted-foreground">{t("foreignIdNote")}</p>
          <PhoneInput
            key={`${i}-${applyVersion[i] ?? 0}`}
            id={`persons.${i}.phone`}
            label={common("phoneLabel")}
            required={requireAllFields && i === 0}
            defaultValue={p.phone}
          />
          <Field
            id={`persons.${i}.email`}
            label={common("emailLabel")}
            type="email"
            required={requireAllFields && i === 0}
            value={p.email ?? ""}
            onChange={(v) =>
              setPersons((prev) =>
                prev.map((x, idx) => (idx === i ? { ...x, email: v } : x)),
              )
            }
          />
        </fieldset>
      ))}

      {canAdd ? (
        <button
          type="button"
          onClick={() => setPersons((prev) => [...prev, { name: "" }])}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-dashed border-input py-3 text-sm text-muted-foreground hover:bg-muted/30"
        >
          <Plus className="h-4 w-4" aria-hidden />
          {labels.addAnother}
        </button>
      ) : (
        <p className="rounded-md border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
          {labels.capNote}
        </p>
      )}

      {showCommunicationLang && <fieldset className="flex flex-col gap-2 rounded-lg border p-4">
        <legend className="px-1 text-sm font-semibold">
          {labels.commLangPrompt}
        </legend>
        <p className="text-xs text-muted-foreground">{t("commLangNote")}</p>
        <div className="mt-1 flex gap-3">
          {(["hebrew", "english"] as const).map((v) => (
            <label
              key={v}
              className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border border-input p-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5"
            >
              <input
                type="radio"
                name="communicationLang"
                value={v}
                defaultChecked={initialCommunicationLang === v}
                className="sr-only"
              />
              <span>{v === "hebrew" ? common("hebrew") : common("english")}</span>
            </label>
          ))}
        </div>
      </fieldset>}

      {/* Carries the Monday item ID of the client chosen from the picker, so the
          server action can trigger any board-side updates (status change etc.). */}
      {selectedClientId && (
        <input type="hidden" name="selectedClientId" value={selectedClientId} />
      )}
      {/* Carries the Offers-board item ID when a suggestion sourced from
          there was picked, so submitDeal() can mark it Accepted on submit. */}
      {selectedOfferId && (
        <input type="hidden" name="selectedOfferId" value={selectedOfferId} />
      )}

      {state?.ok === false && (
        <Alert variant="destructive">
          <AlertDescription className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>{state.message}</span>
          </AlertDescription>
        </Alert>
      )}

      <Button type="submit" size="lg" disabled={isPending}>
        {showSpinner && (
          <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden />
        )}
        {isPending
          ? slowNotice
            ? common("stillSending")
            : common("sending")
          : common("continue")}
      </Button>
      <p className="text-xs text-muted-foreground">
        {common("requiredNotePrefix")} <span className="text-primary">*</span>{" "}
        {common("requiredNoteSuffix")} {t("canContinueWithoutNote")}
      </p>
    </form>
  );
}

function Field({
  id,
  label,
  required,
  type = "text",
  inputMode,
  value,
  onChange,
}: {
  id: string;
  label: string;
  required?: boolean;
  type?: string;
  inputMode?: "text" | "numeric" | "tel" | "email";
  value: string;
  onChange: (v: string) => void;
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
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        dir={type === "email" || inputMode === "numeric" || inputMode === "tel" ? "ltr" : undefined}
      />
    </div>
  );
}
