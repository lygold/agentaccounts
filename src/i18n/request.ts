import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, locales, defaultLocale, type Locale } from "./locales";

export default getRequestConfig(async () => {
  const jar = await cookies();
  const cookieValue = jar.get(LOCALE_COOKIE)?.value;
  const locale: Locale = locales.includes(cookieValue as Locale)
    ? (cookieValue as Locale)
    : defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
