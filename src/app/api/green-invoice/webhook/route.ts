import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";

/**
 * Green Invoice / Morning "document created" webhook.
 *
 * STAGE 1 (Phase 6 discovery — current): capture + signature probe. Logs the
 * raw body, the headers, and every plausible HMAC-SHA256 construction of the
 * secret so we can see which one matches GI's `x-webhook-signature`. Always
 * 200 so GI doesn't retry-storm.
 *
 * TODO STAGE 2: keep only the verified signature check, resolve the document
 * to a deal via the gi-documents table, create income + post commission for a
 * receipt (320/400), advance the deal lifecycle. Then stop logging payloads
 * (they carry client PII).
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  const sig = headers["x-webhook-signature"] ?? "";
  const ts = headers["x-webhook-timestamp"] ?? "";
  const secret = process.env.GREEN_INVOICE_WEBHOOK_SECRET ?? "";

  const hmac = (msg: string) =>
    createHmac("sha256", secret).update(msg, "utf8").digest("hex");

  const candidates: Record<string, string> = secret
    ? {
        body: hmac(rawBody),
        "ts.body": hmac(`${ts}.${rawBody}`),
        "ts+body": hmac(`${ts}${rawBody}`),
        "body.ts": hmac(`${rawBody}.${ts}`),
        "id+ts": hmac(`${headers["x-webhook-id"] ?? ""}${ts}${rawBody}`),
      }
    : {};
  const match =
    Object.entries(candidates).find(([, v]) => v === sig)?.[0] ?? "NONE";

  console.log("[gi-webhook] --- inbound ---");
  console.log("[gi-webhook] topic:", headers["x-webhook-topic"]);
  console.log("[gi-webhook] received sig:", sig, "| secret set:", !!secret);
  console.log("[gi-webhook] hmac candidates:", JSON.stringify(candidates));
  console.log("[gi-webhook] >>> MATCH:", match);
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
