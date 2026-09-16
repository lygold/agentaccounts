"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Label } from "./label";

export interface SearchableSelectOption {
  value: string;
  label: string;
  /** Shown after the label, also searchable — e.g. a team number. */
  hint?: string;
}

/**
 * A searchable dropdown that still behaves like a plain `<select>` inside a
 * server-action `<form>`: it submits a single value under `name` via a
 * hidden input, so no client-side submit handling is needed. Typing filters
 * the option list by label + hint.
 *
 * Use for long lists (agents) where a native `<select>` makes finding one
 * name tedious. Short fixed enums (role, deal type, side, …) are still
 * plain `<select>` — search adds a click with no payoff at 2-7 options.
 */
export function SearchableSelect({
  name,
  options,
  defaultValue,
  placeholder,
  emptyLabel = "No matches",
  required,
  className,
  id,
  label,
  onChange,
  /** RTL-aware rendering (right-aligned text, `dir="rtl"` on the input and
   *  option list) — off by default so existing (LTR) callers are
   *  unaffected; pass true for Hebrew-first contexts like the property
   *  wizard. */
  rtl,
}: {
  name: string;
  options: SearchableSelectOption[];
  defaultValue?: string;
  placeholder?: string;
  emptyLabel?: string;
  required?: boolean;
  className?: string;
  id?: string;
  /** Optional label rendered above the field — callers that already wrap
   *  this in their own <Label> can leave this unset. */
  label?: string;
  /** Fired when the selection changes — the hidden input already covers
   *  form submission; this is for parents that need to react (e.g. show
   *  conditional fields based on the pick). */
  onChange?: (value: string) => void;
  rtl?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [value, setValue] = useState(defaultValue ?? "");
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.hint?.toLowerCase().includes(q),
    );
  }, [options, query]);

  useEffect(() => {
    if (open) setHighlight(0);
  }, [open, filtered.length]);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  function choose(o: SearchableSelectOption) {
    setValue(o.value);
    onChange?.(o.value);
    setOpen(false);
    setQuery("");
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && filtered[highlight]) choose(filtered[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
      inputRef.current?.blur();
    }
  }

  return (
    <div ref={rootRef} className="relative flex flex-col gap-1.5">
      {label && (
        <Label htmlFor={id}>
          {label}
          {required && <span className="text-primary"> *</span>}
        </Label>
      )}
      <input type="hidden" name={name} value={value} required={required} />
      <input
        ref={inputRef}
        id={id}
        type="text"
        dir={rtl ? "rtl" : undefined}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        className={cn(
          "flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
        placeholder={placeholder}
        value={open ? query : (selected?.label ?? "")}
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        onChange={(e) => {
          setOpen(true);
          setQuery(e.target.value);
        }}
        onKeyDown={onKeyDown}
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          dir={rtl ? "rtl" : undefined}
          className="absolute top-full z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-background py-1 text-sm shadow-md"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-muted-foreground">{emptyLabel}</li>
          ) : (
            filtered.map((o, i) => (
              <li key={o.value}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center justify-between gap-2 px-3 py-2 hover:bg-muted",
                    rtl ? "text-right" : "text-left",
                    i === highlight && "bg-muted",
                  )}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => choose(o)}
                >
                  <span>{o.label}</span>
                  {o.hint && <span className="text-xs text-muted-foreground">{o.hint}</span>}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
