"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface SearchableSelectOption {
  value: string;
  label: string;
}

interface Props {
  id: string;
  name: string;
  label?: string;
  required?: boolean;
  options: SearchableSelectOption[];
  defaultValue?: string;
  placeholder: string;
  searchPlaceholder: string;
  /** Fired when the selection changes — for parents that need to react
   *  (e.g. showing extra fields when a specific option is picked). The
   *  form submission itself never needs this; the hidden input covers it. */
  onChange?: (value: string) => void;
}

/**
 * A `<select>` replacement that's searchable — plugs into the same plain
 * `<form action={serverAction}>` pattern as every other wizard field via a
 * hidden input, so no server action needs to change to use this instead of
 * a native select. Built after live feedback that the wizard's long
 * dropdown lists (property type, referral source, etc.) were hard to
 * scan/use as native selects.
 */
export function SearchableSelect({
  id,
  name,
  label,
  required,
  options,
  defaultValue,
  placeholder,
  searchPlaceholder,
  onChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(defaultValue ?? "");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const selectedLabel = options.find((o) => o.value === selected)?.label ?? "";
  const q = query.trim().toLowerCase();
  const filtered = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;

  return (
    <div className="relative flex flex-col gap-1.5" ref={containerRef}>
      {label && (
        <Label htmlFor={id}>
          {label}
          {required && <span className="text-primary"> *</span>}
        </Label>
      )}
      <input type="hidden" name={name} value={selected} required={required} />
      <button
        id={id}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 items-center justify-between rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className={selectedLabel ? "" : "text-muted-foreground"}>
          {selectedLabel || placeholder}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
      </button>
      {open && (
        <div className="absolute top-full z-10 mt-1 w-full overflow-hidden rounded-md border bg-background shadow-md">
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            dir="rtl"
            className="rounded-none border-0 border-b focus-visible:ring-0"
          />
          <ul className="max-h-64 overflow-y-auto text-sm">
            {filtered.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(o.value);
                    onChange?.(o.value);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={[
                    "w-full px-3 py-2 text-right hover:bg-muted/40",
                    selected === o.value ? "bg-primary/5 font-medium" : "",
                  ].join(" ")}
                >
                  {o.label}
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-muted-foreground">{searchPlaceholder}</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
