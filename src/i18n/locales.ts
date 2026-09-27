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

/** A handful of documents (offers, deals) carry their own fixed
 *  `DocLanguage` ("hebrew"/"english", chosen once and baked into a signed
 *  PDF) independent of the viewer's site-wide `locale` cookie above — a
 *  buyer filling in a Hebrew offer form must see Hebrew regardless of what
 *  their own browser's cookie says. Type-only import: this file stays free
 *  of any runtime dependency on lib/types. */
export function docLanguageToLocale(lang: import("../lib/types").DocLanguage): Locale {
  return lang === "hebrew" ? "he" : "en";
}
