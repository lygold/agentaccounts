"use server";

import { redirect } from "next/navigation";
import { OfferSubmitSchema } from "@/lib/form-parse";
import { getOfferByToken, updateOffer } from "@/lib/store/offers";
import { getAgentById } from "@/lib/store/agents";
import { uploadOfferFile } from "@/lib/offers/storage";
import { renderOfferPdf } from "@/lib/offers/pdf/render";
import { notifyOfferReady } from "@/lib/services/offer-notify";
import { isNextJsRedirect } from "@/lib/action-utils";
import type { OfferRecord } from "@/lib/types";

/** data:image/png;base64,AAAA... -> Buffer. Returns null for an empty/
 *  malformed value rather than throwing — the caller decides whether that's
 *  fatal (signature1 is required, signature2 is only required when a
 *  second buyer's fields are present). */
function decodeSignature(value: FormDataEntryValue | null): Buffer | null {
  if (typeof value !== "string" || !value.startsWith("data:image/")) return null;
  const base64 = value.split(",")[1];
  if (!base64) return null;
  try {
    return Buffer.from(base64, "base64");
  } catch {
    return null;
  }
}

/**
 * Buyer's final submit. Never trusts anything posted except the token
 * itself (re-fetches the offer server-side, same defense-in-depth as every
 * other action in this app that receives a client-scoped id) — this is
 * doubly important here since the page has no session at all.
 */
export async function submitOffer(token: string, formData: FormData) {
  try {
    const offer = await getOfferByToken(token);
    if (!offer) redirect(`/offer/${token}`);
    if (offer.submittedAt) redirect(`/offer/${token}`);

    const parsed = OfferSubmitSchema.safeParse({
      buyerName: formData.get("buyerName"),
      buyerIdNumber: formData.get("buyerIdNumber"),
      buyerName2: formData.get("buyerName2"),
      buyerIdNumber2: formData.get("buyerIdNumber2"),
      price: formData.get("price"),
      paymentTerms: formData.get("paymentTerms"),
      requestedTransferDate: formData.get("requestedTransferDate"),
      extendedTransferDate: formData.get("extendedTransferDate"),
      contentsToLeave: formData.get("contentsToLeave"),
      notes: formData.get("notes"),
    });
    if (!parsed.success) redirect(`/offer/${token}?error=save`);

    const signature1 = decodeSignature(formData.get("signature1"));
    if (!signature1) redirect(`/offer/${token}?error=save`);

    const hasSecondBuyer = !!parsed.data.buyerName2 || !!parsed.data.buyerIdNumber2;
    const signature2 = hasSecondBuyer ? decodeSignature(formData.get("signature2")) : null;
    if (hasSecondBuyer && !signature2) redirect(`/offer/${token}?error=save`);

    const [signature1S3Key, signature2S3Key] = await Promise.all([
      uploadOfferFile(offer.officeId, offer.id, "signature1", signature1),
      signature2 ? uploadOfferFile(offer.officeId, offer.id, "signature2", signature2) : Promise.resolve(undefined),
    ]);

    // In-memory merge, not yet written — renderOfferPdf just needs the
    // fields, and this way the whole submission is a single DB write below
    // rather than "save buyer fields, render, save again".
    const merged: OfferRecord = { ...offer, ...parsed.data };
    const pdfBuffer = await renderOfferPdf({
      offer: merged,
      signature1,
      signature2: signature2 ?? undefined,
    });
    const pdfS3Key = await uploadOfferFile(offer.officeId, offer.id, "pdf", pdfBuffer);

    const now = new Date().toISOString();
    const updated = await updateOffer(
      offer.id,
      {
        ...parsed.data,
        signature1S3Key,
        signature2S3Key,
        pdfS3Key,
        pdfGeneratedAt: now,
        submittedAt: now,
        status: "new",
      },
      offer.officeId,
    );
    if (!updated) redirect(`/offer/${token}?error=save`);

    const agent = await getAgentById(offer.agentId);
    await notifyOfferReady(updated, agent?.email ?? null);

    // Explicit redirect rather than relying on Next's implicit post-action
    // revalidation — in practice the buyer was left staring at a stuck
    // "Sending..." button until they manually reloaded, even though the
    // submission had already succeeded server-side. Same URL, but the
    // navigation forces a fresh render, which now hits the submittedAt
    // branch and shows the "already submitted"/thank-you state immediately.
    redirect(`/offer/${token}`);
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("submitOffer failed:", e);
    redirect(`/offer/${token}?error=save`);
  }
}
