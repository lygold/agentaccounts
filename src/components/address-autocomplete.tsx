"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { searchAddress, resolveAddress } from "@/lib/places-actions";
import type { AddressSuggestion, PlaceAddressDetails } from "@/lib/places";

interface Props {
  id: string;
  label?: string;
  required?: boolean;
  /** Initial display text — e.g. a formattedAddress already on the draft
   *  (prefilled from a signed-contract pick). Purely the visible query
   *  text; it does NOT re-resolve until the agent picks a new suggestion. */
  defaultValue?: string;
  /** Fired once per selected suggestion, after the terminating Place
   *  Details (Essentials) call resolves. The parent wizard step owns the
   *  actual editable city/street/etc. fields from here — same pattern as
   *  the deal wizard's own manual-entry fields staying editable after a
   *  picker prefill. */
  onResolved: (details: PlaceAddressDetails) => void;
}

/**
 * Type-ahead address search backed by Places API (New) — see
 * src/lib/places.ts / places-actions.ts. Deliberately calls a server
 * action rather than loading Google's JS library client-side, so
 * GOOGLE_MAPS_API_KEY never reaches the browser.
 */
export function AddressAutocomplete({ id, label, required, defaultValue = "", onResolved }: Props) {
  const t = useTranslations("AddressAutocomplete");
  const [query, setQuery] = useState(defaultValue);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  // One session token per autocomplete "conversation" (keystrokes ->
  // picked suggestion) — required for Places' free session-based pricing.
  // A fresh one is minted after each pick since that call terminates the
  // session; see places.ts's doc comment.
  const sessionTokenRef = useRef<string>(crypto.randomUUID());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  function handleChange(value: string) {
    setQuery(value);
    setOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        setSuggestions(await searchAddress(value, sessionTokenRef.current));
      } finally {
        setLoading(false);
      }
    }, 300);
  }

  async function handleSelect(suggestion: AddressSuggestion) {
    setOpen(false);
    setSuggestions([]);
    setQuery(suggestion.mainText);
    const details = await resolveAddress(suggestion.placeId, sessionTokenRef.current);
    sessionTokenRef.current = crypto.randomUUID();
    if (details) onResolved(details);
  }

  return (
    <div className="relative flex flex-col gap-1.5">
      {label && (
        <Label htmlFor={id}>
          {label}
          {required && <span className="text-primary"> *</span>}
        </Label>
      )}
      <Input
        id={id}
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        // Delay so a suggestion's onClick still fires before the list unmounts.
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        autoComplete="off"
        dir="rtl"
      />
      {open && (loading || suggestions.length > 0) && (
        <ul className="absolute top-full z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-md border bg-background text-sm shadow-md">
          {loading && suggestions.length === 0 && (
            <li className="px-3 py-2 text-muted-foreground">{t("loading")}</li>
          )}
          {suggestions.map((s) => (
            <li key={s.placeId}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(s)}
                className="flex w-full flex-col gap-0.5 px-3 py-2 text-right hover:bg-muted/40"
              >
                <span className="font-medium">{s.mainText}</span>
                {s.secondaryText && (
                  <span className="text-xs text-muted-foreground">{s.secondaryText}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
