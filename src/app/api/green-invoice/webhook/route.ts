import { NextResponse } from "next/server";

/**
 * Green Invoice / Morning "document created" webhook.
 *
 * STAGE 1 (Phase 6 discovery — current): capture only. Logs the raw body and
 * every header so we can see GI's real payload shape and how the webhook
 * secret is transmitted (HMAC signature header vs. static token) before
 * building the real handler. Always 200 so GI doesn't retry-storm.
 *
 * TODO STAGE 2: verify GREEN_INVOICE_WEBHOOK_SECRET, resolve the document to a
 * deal via the gi-documents table, create income + post commission for a
 * receipt (320/400), advance the deal lifecycle. Then stop logging payloads
 * (they carry client PII).
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  console.log("[gi-webhook] --- inbound ---");
  console.log("[gi-webhook] headers:", JSON.stringify(headers));
  console.log("[gi-webhook] body:", rawBody || "(empty)");

  return NextResponse.json({ received: true });
}

/** Lets you (and GI's "test" button) confirm the URL is reachable. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "green-invoice webhook",
    stage: "capture",
  });
}
