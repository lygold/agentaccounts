import { existsSync } from "node:fs";
import { createTranslator, NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { getOfferByToken } from "@/lib/store/offers";
import { getAttachmentUrl } from "@/lib/s3-attachments";
import { docLanguageToLocale, isRtlLocale } from "@/i18n/locales";
import { appAssetPath } from "@/lib/app-asset-path";
import { OfferPublicForm } from "./offer-public-form";

// See lib/app-asset-path.ts — NOT process.cwd(), confirmed unreliable here
// by direct production evidence (2026-09-28).
const LOGO_PATH = appAssetPath("remax-logo.png");

/**
 * Stage 2, buyer-facing — NO session, NO <Nav/> (the buyer is not an app
 * user; showing internal navigation here would be actively wrong). The
 * token in the URL is the entire auth model — see middleware.ts's
 * PUBLIC_PATHS and OfferRecord's doc comment in lib/types.ts.
 *
 * Language is the OFFER's `language` (fixed by the agent when the link was
 * created, baked into the signed PDF), never the visitor's site-wide
 * `locale` cookie — a buyer must see the same language the document they're
 * about to sign is in, regardless of what a different tab/session on this
 * device last set. Hence the local NextIntlClientProvider below rather than
 * relying on the root layout's cookie-derived one, and createTranslator
 * (locale-explicit, not request-scoped) for this page's own server strings.
 */
export default async function OfferPublicPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;
  const offer = await getOfferByToken(token);

  if (!offer) {
    const t = await getTranslations("OfferPublic");
    return (
      <main className="mx-auto max-w-lg p-6 text-center">
        <p className="text-muted-foreground">{t("notFound")}</p>
      </main>
    );
  }

  const locale = docLanguageToLocale(offer.language);
  const dir = isRtlLocale(locale) ? "rtl" : "ltr";
  const messages = (await import(`../../../../messages/${locale}.json`)).default;
  const t = createTranslator({ locale, messages, namespace: "OfferPublic" });
  const showLogo = offer.withLogo && existsSync(LOGO_PATH);

  if (offer.submittedAt) {
    const pdfUrl = offer.pdfS3Key ? await getAttachmentUrl(offer.pdfS3Key) : null;
    return (
      <main dir={dir} lang={locale} className="mx-auto flex max-w-lg flex-col items-center gap-4 p-6 text-center">
        {showLogo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/remax-logo.png" alt="RE/MAX" className="mb-2 h-16 w-auto" />
        )}
        <h1 className="text-2xl font-bold">{t("thankYouTitle")}</h1>
        {pdfUrl && (
          <p className="rounded-full border bg-muted/40 px-4 py-2 text-sm">
            {t("viewSubmission")}{" "}
            <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="text-secondary underline underline-offset-4">
              {t("clickHere")}
            </a>
          </p>
        )}
      </main>
    );
  }

  return (
    <main dir={dir} lang={locale} className="mx-auto max-w-lg p-6">
      {showLogo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/remax-logo.png" alt="RE/MAX" className="mb-2 h-16 w-auto" />
      )}
      <h1 className="mb-1 text-xl font-bold">{t("title")}</h1>
      <p className="mb-6 text-sm text-muted-foreground">{offer.propertyAddress}</p>
      {error && <p className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">{t("saveFailed")}</p>}
      <NextIntlClientProvider locale={locale} messages={messages}>
        <OfferPublicForm
          token={token}
          propertyAddress={offer.propertyAddress}
          ownerName={offer.ownerName}
        />
      </NextIntlClientProvider>
    </main>
  );
}
