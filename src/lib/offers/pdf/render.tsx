import "server-only";
import path from "node:path";
import { existsSync } from "node:fs";
import { renderToBuffer } from "@react-pdf/renderer";
import type { OfferRecord } from "../../types";
import { OfferDocument } from "./offer-document";

// Not sourced yet — Levi needs to provide the actual RE/MAX logo file (the
// old Make scenario pointed at a Drive-hosted image). Until it's dropped in
// here, "with logo" silently falls back to no logo rather than failing the
// whole PDF — see the withLogo handling below.
const LOGO_PATH = path.join(process.cwd(), "public", "remax-logo.png");

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

  return renderToBuffer(
    <OfferDocument
      language={offer.language}
      logoSrc={withLogo ? LOGO_PATH : undefined}
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
