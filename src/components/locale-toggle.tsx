"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLocale } from "@/i18n/actions";
import { locales, localeNames, type Locale } from "@/i18n/locales";

/**
 * Persistent corner switcher for the UI's rendering language. Per-device
 * (cookie), not tied to the agent's identity.
 *
 * Deliberately pinned to the same physical screen corner (top-right) in
 * every language rather than tracking the RTL/LTR trailing edge — a
 * switcher that jumps to the opposite corner when you switch languages is
 * harder to find again than one that stays put. Hence the fixed dir="ltr"
 * + right-3 below, not logical end-3 positioning.
 *
 * A native <select> rather than a row of buttons — scales to any number of
 * languages without a redesign; adding a locale is just an entry in
 * `locales`/`localeNames` plus a messages file.
 *
 * Uses router.refresh() (soft re-render of server content) rather than a
 * hard reload, same pattern as sikkumPigisha's toggle.
 */
export function LocaleToggle({ current }: { current: Locale }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onChange(next: string) {
    if (next === current || !locales.includes(next as Locale)) return;
    startTransition(async () => {
      await setLocale(next as Locale);
      router.refresh();
    });
  }

  return (
    <div
      className="fixed top-3 right-3 z-50 rounded-full border bg-background/90 shadow-sm backdrop-blur"
      dir="ltr"
    >
      <select
        value={current}
        disabled={isPending}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Language / שפה"
        className="cursor-pointer appearance-none rounded-full bg-transparent px-3 py-1 text-xs text-foreground disabled:opacity-60"
      >
        {locales.map((locale) => (
          <option key={locale} value={locale}>
            {localeNames[locale]}
          </option>
        ))}
      </select>
    </div>
  );
}
