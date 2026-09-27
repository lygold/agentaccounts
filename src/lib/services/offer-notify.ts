import "server-only";
import { sendNotificationEmail } from "../email/notification-webhook";
import { APP_BASE_URL } from "../office";
import type { OfferRecord } from "../types";

/**
 * Buyer signed → tell the agent, modeled directly on
 * services/property-notify.ts's notifyPropertyUpdated: never throws, logs
 * and swallows a failed send rather than blocking the buyer's submit (the
 * offer/PDF are already saved by the time this runs).
 *
 * Links to /offers/[id] (authenticated — presigns the PDF fresh on render,
 * same pattern as deal attachments) rather than attaching the PDF bytes to
 * the email itself: sendNotificationEmail's Make webhook contract is
 * {to, subject, body} only, no attachment support today, and a baked-in S3
 * link would either need a long-lived presigned URL (this app deliberately
 * avoids those — see s3-attachments.ts) or go stale before the agent reads
 * their email.
 *
 * The Ariyel/ops "new raw offer" ping the old Monday board automation did is
 * explicitly NOT built here — deferred per Levi, 2026-09-17.
 */
export async function notifyOfferReady(offer: OfferRecord, agentEmail: string | null): Promise<void> {
  if (!agentEmail) {
    console.info(`[offer-notify] offer ${offer.id}: agent has no email on file, skipping`);
    return;
  }

  try {
    await sendNotificationEmail({
      to: agentEmail,
      subject: "הצעת המחיר שלך מוכנה לצפייה",
      body: `היי,\n\nהצעת המחיר עבור ${offer.propertyAddress} נחתמה והיא זמינה לצפייה.\n\n${APP_BASE_URL}/offers/${offer.id}\n\nבהצלחה!`,
    });
  } catch (e) {
    console.error(`[offer-notify] failed to notify agent for offer ${offer.id}:`, e);
  }
}
