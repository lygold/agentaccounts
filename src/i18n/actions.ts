"use server";

import { cookies } from "next/headers";
import { LOCALE_COOKIE, locales, type Locale } from "./locales";

export async function setLocale(locale: Locale) {
  if (!locales.includes(locale)) return;
  const jar = await cookies();
  jar.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
