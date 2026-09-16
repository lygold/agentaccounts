import "server-only";

/**
 * Generic notification email — a SEPARATE Make.com scenario from the OTP
 * webhook (make-webhook.ts), since that one has a fixed
 * {email, code, ttlMinutes, language} payload built only for OTP delivery.
 * This one takes a plain {to, subject, body} so it can carry any message
 * (property-edit notifications first, more uses later). Levi builds the
 * Make scenario; MAKE_NOTIFICATION_WEBHOOK_URL points at it.
 */
export async function sendNotificationEmail(opts: {
  to: string;
  subject: string;
  body: string;
}): Promise<void> {
  const url = process.env.MAKE_NOTIFICATION_WEBHOOK_URL;
  if (!url) {
    throw new Error("MAKE_NOTIFICATION_WEBHOOK_URL is not set");
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Make notification webhook failed (${res.status}): ${text.slice(0, 500)}`);
  }
}
