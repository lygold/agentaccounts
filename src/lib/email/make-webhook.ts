import "server-only";

/**
 * OTP-by-email fallback — same Make.com webhook contract as sikkumPigisha's
 * src/lib/email/make-webhook.ts ({ email, code, ttlMinutes, language }), so
 * the same Make scenario can serve both apps if MAKE_OTP_WEBHOOK_URL points
 * to it.
 */
export async function sendOtpEmail(opts: {
  email: string;
  code: string;
  ttlMinutes: number;
  language?: "hebrew" | "english";
}): Promise<void> {
  const url = process.env.MAKE_OTP_WEBHOOK_URL;
  if (!url) {
    throw new Error("MAKE_OTP_WEBHOOK_URL is not set");
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: opts.email,
      code: opts.code,
      ttlMinutes: opts.ttlMinutes,
      language: opts.language ?? "hebrew",
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Make OTP webhook failed (${res.status}): ${text.slice(0, 500)}`);
  }
}
