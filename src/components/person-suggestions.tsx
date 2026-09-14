"use client";

import { useTranslations } from "next-intl";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export interface PersonSuggestion {
  id: string;
  /** Offers board only ever has name + ID, never phone/email. Signed
   *  Contracts has full contact info. */
  source: "offer" | "signed-contract";
  person1: {
    name: string;
    idNumber: string | null;
    phone?: string | null;
    email?: string | null;
  };
  /** Joint offers only — Signed Contracts suggestions never have this. */
  person2?: { name: string; idNumber: string | null } | null;
  /** Address text shown on the card, from whichever board this came from. */
  contextLabel?: string | null;
  /** Signed Contracts item id — lets the picker's existing selectedClientId
   *  wiring pick this up the same way a manual picker selection would.
   *  Never set for offer-sourced suggestions (different board entirely). */
  clientId?: string;
  /** Offers-board item id — set only for source "offer", so selecting it can
   *  mark that offer Accepted once the deal is actually submitted. */
  offerId?: string;
}

interface PersonSuggestionsProps {
  title: string;
  suggestions: PersonSuggestion[];
  onSelect: (s: PersonSuggestion) => void;
  onDismiss: () => void;
}

/**
 * Suggests people for the deal's property before the agent has typed
 * anything — used on the buyers step (Offers board first, falling back to
 * Signed Contracts) and the owners step (Signed Contracts only, since there's
 * no owner-side equivalent of the Offers board).
 */
export function PersonSuggestions({
  title,
  suggestions,
  onSelect,
  onDismiss,
}: PersonSuggestionsProps) {
  const t = useTranslations("PersonSuggestions");
  if (suggestions.length === 0) return null;

  return (
    <Alert className="border-primary/40 bg-primary/5">
      <AlertDescription className="flex flex-col gap-3">
        <span className="font-semibold">{title}</span>
        <ul className="flex flex-col gap-2">
          {suggestions.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onSelect(s)}
                className="flex w-full flex-col gap-0.5 rounded-md border p-3 text-right hover:bg-muted/40"
              >
                <span className="font-medium">
                  {s.person2
                    ? t("pairLabel", { name1: s.person1.name, name2: s.person2.name })
                    : s.person1.name}
                </span>
                {s.contextLabel && (
                  <span className="text-xs text-muted-foreground">
                    {s.contextLabel}
                  </span>
                )}
                {s.source === "offer" && (
                  <span className="text-xs text-muted-foreground">
                    {t("offerSourceNote")}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onDismiss}
          className="self-start"
        >
          {t("noneOfThese")}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
