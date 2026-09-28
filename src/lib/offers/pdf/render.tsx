import "server-only";
import { existsSync, readFileSync } from "node:fs";
import { renderToBuffer } from "@react-pdf/renderer";
import { appAssetPath } from "../../app-asset-path";
import type { OfferRecord } from "../../types";
import { OfferDocument } from "./offer-document";

// If this file is missing, "with logo" silently falls back to no logo
// rather than failing the whole PDF — see the withLogo handling below.
// See app-asset-path.ts — NOT process.cwd(), confirmed unreliable here by
// direct production evidence (2026-09-28).
const LOGO_PATH = appAssetPath("remax-logo.png");

export interface RenderOfferPdfInput {
  offer: OfferRecord;
  signature1: Buffer;
  signature2?: Buffer;
}

export async function renderOfferPdf({
  offer,
  signature1,
  signature2,
}: RenderOfferPdfInput): Promise<Buffer> {
  if (!offer.buyerName || !offer.buyerIdNumber || offer.price === undefined) {
    throw new Error(`renderOfferPdf(${offer.id}): missing required buyer fields`);
  }

  const withLogo = offer.withLogo && existsSync(LOGO_PATH);
  if (offer.withLogo && !withLogo) {
    console.warn(`renderOfferPdf(${offer.id}): withLogo requested but ${LOGO_PATH} is missing`);
  }
  // A raw path string makes @react-pdf/renderer's <Image> try to fetch() it
  // as a URL, which fails outright for a local filesystem path (confirmed:
  // "fetch failed" — this code path had never actually run before today,
  // since the logo file never existed until now). Reading it into a Buffer
  // ourselves sidesteps URL resolution entirely, same as signature1/2 below.
  const logoBuffer = withLogo ? readFileSync(LOGO_PATH) : undefined;

  return renderToBuffer(
    <OfferDocument
      language={offer.language}
      logoSrc={logoBuffer}
      buyerName={offer.buyerName}
      buyerIdNumber={offer.buyerIdNumber}
      buyerName2={offer.buyerName2}
      buyerIdNumber2={offer.buyerIdNumber2}
      propertyAddress={offer.propertyAddress}
      ownerName={offer.ownerName}
      price={offer.price}
      paymentTerms={offer.paymentTerms}
      requestedTransferDate={offer.requestedTransferDate}
      extendedTransferDate={offer.extendedTransferDate}
      contentsToLeave={offer.contentsToLeave}
      notes={offer.notes}
      signature1={signature1}
      signature2={signature2}
    />,
  );
}
