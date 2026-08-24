/**
 * Pure constants — deliberately kept free of any "next/headers"-touching
 * import so Client Components (e.g. locale-toggle.tsx) can import them
 * directly. request.ts (server-only, reads the cookie) imports from here,
 * not the other way around.
 */
export const LOCALE_COOKIE = "locale";
export const locales = ["he", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "he";

/** Each language's own name, in its own script — shown in the locale
 *  switcher. Add an entry here (+ a messages/<code>.json file) to add a
 *  language; the switcher picks it up automatically. */
export const localeNames: Record<Locale, string> = {
  he: "עברית",
  en: "English",
};

export function isRtlLocale(locale: Locale): boolean {
  return locale === "he";
}
