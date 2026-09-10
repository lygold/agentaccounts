import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getRedis, RedisKeys } from "@/lib/redis";
import { getDeal } from "@/lib/store/deals";
import { getGiDocument, putGiDocument } from "@/lib/store/gi-documents";
import { recordDealPayment } from "@/lib/services/payments";
import { greenInvoiceFetch } from "@/lib/green-invoice/client";
import { processGiDocument, type GiWebhookDoc } from "@/lib/green-invoice/webhook-handler";

/**
 * Green Invoice / Morning webhook — `document/created` for every doc type.
 * Verified live against the sandbox 2026-09-10, see docs/mem/gi-webhook.md.
 *
 * - signature: `HMAC-SHA256(GREEN_INVOICE_WEBHOOK_SECRET, rawBody)` hex, in
 *   `x-webhook-signature`
 * - idempotency: keyed on the GI document id (stable across retries — the
 *   delivery id is not)
 * - the app only ever creates 300s; Levi/Ariyel issue 305/320/400 in GI, and
 *   this turns those into income + commission
 */

function verifySignature(rawBody: string, sig: string): boolean {
  const secret = process.env.GREEN_INVOICE_WEBHOOK_SECRET;
  if (!secret || !sig) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(sig, "hex"));
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const sig = request.headers.get("x-webhook-signature") ?? "";

  if (!verifySignature(rawBody, sig)) {
    console.warn("[gi-webhook] signature check failed — rejecting");
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let doc: GiWebhookDoc;
  try {
    doc = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!doc?.id || typeof doc.type !== "number") {
    return NextResponse.json({ error: "not a document payload" }, { status: 202 });
  }

  // Idempotency — a 320/400 must only ever be processed once, even if GI
  // redelivers it. Redis SET NX is the fast atomic guard; the gi-documents
  // row existing is the durable backstop (checked in the handler).
  if (doc.type !== 300) {
    try {
      const fresh = await getRedis().set(RedisKeys.giWebhookDoc(doc.id), Date.now(), {
        nx: true,
        ex: 60 * 60 * 24 * 30,
      });
      if (fresh === null) {
        console.log(`[gi-webhook] ${doc.type} ${doc.id} already handled — skipping`);
        return NextResponse.json({ received: true, duplicate: true });
      }
    } catch (e) {
      console.error("[gi-webhook] Redis dedup unavailable, relying on the DB guard:", e);
    }
  }

  try {
    await processGiDocument(doc, {
      getGiDocument,
      putGiDocument,
      getDeal,
      recordDealPayment,
      fetchGiDocument: (id) =>
        greenInvoiceFetch(`/documents/${id}`) as Promise<{
          linkedDocuments?: Array<{ id: string; type: number }>;
        }>,
    });
  } catch (e) {
    // Always 200 past signature/parse: GI retrying won't fix a logic error,
    // and the scheduled poll re-checks for genuine misses. Release the Redis
    // guard so a poll-triggered reprocess isn't blocked.
    console.error(`[gi-webhook] handling ${doc.type} ${doc.id} failed:`, e);
    try {
      await getRedis().del(RedisKeys.giWebhookDoc(doc.id));
    } catch {}
  }

  return NextResponse.json({ received: true });
}

/** Reachability check — also what GI's config UI pings when you save the URL. */
export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "green-invoice webhook" });
}
