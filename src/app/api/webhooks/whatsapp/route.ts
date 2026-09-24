import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getRedis, RedisKeys } from "@/lib/redis";

/**
 * Meta WhatsApp Cloud API webhook — debugging visibility only (Levi: "sent"
 * showing in our own DB just means Meta's send API returned 200; it says
 * nothing about actual delivery, since we've never consumed Meta's own
 * status callbacks). This captures those callbacks so a referral invite
 * that looks "sent" but never arrived can actually be diagnosed, without
 * digging through CloudWatch every time — see /admin/whatsapp-debug.
 *
 * Setup (Meta for Developers, the app connected to this WABA — see the
 * chat history for how that was actually tracked down):
 *   WhatsApp → Configuration → Webhook
 *     Callback URL: https://<host>/api/webhooks/whatsapp
 *     Verify token: whatever META_WEBHOOK_VERIFY_TOKEN is set to
 *   Subscribe to the "messages" field.
 *   App Dashboard → Settings → Basic → App Secret → META_APP_SECRET
 *   (Levi sets these directly in Amplify/​.env.local himself — not pasted
 *   into chat, per how this session has been handling secrets.)
 *
 * Not wired to anything beyond logging + a capped Redis list — no attempt
 * yet to correlate a status event back to a specific ReferralRecord (the
 * webhook payload's message id isn't currently stored anywhere at send
 * time). A reasonable next step if this needs to become more than a
 * debugging aid, not built here.
 */

interface StatusEvent {
  id: string;
  status: string;
  timestamp: string;
  recipient_id: string;
  errors?: Array<{ code: number; title: string; message?: string }>;
}

interface WhatsAppWebhookBody {
  entry?: Array<{
    changes?: Array<{
      value?: {
        statuses?: StatusEvent[];
        messages?: Array<{ from: string; id: string; type: string }>;
      };
    }>;
  }>;
}

function verifySignature(rawBody: string, sig: string | null): boolean {
  const secret = process.env.META_APP_SECRET;
  if (!secret || !sig?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const given = sig.slice("sha256=".length);
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(given, "hex"));
  } catch {
    return false;
  }
}

/** Meta's one-time subscription handshake. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  const expected = process.env.META_WEBHOOK_VERIFY_TOKEN;
  if (mode === "subscribe" && expected && token === expected && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "verification failed" }, { status: 403 });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const sig = request.headers.get("x-hub-signature-256");

  if (!verifySignature(rawBody, sig)) {
    console.warn("[whatsapp-webhook] signature check failed — rejecting");
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let body: WhatsAppWebhookBody;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const redis = getRedis();
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const s of change.value?.statuses ?? []) {
        const event = {
          kind: "status" as const,
          messageId: s.id,
          status: s.status,
          recipient: s.recipient_id,
          errors: s.errors ?? null,
          metaTimestamp: s.timestamp,
          receivedAt: new Date().toISOString(),
        };
        console.log("[whatsapp-webhook] status:", event);
        try {
          await redis.lpush(RedisKeys.whatsappWebhookEvents, JSON.stringify(event));
          await redis.ltrim(RedisKeys.whatsappWebhookEvents, 0, 199);
        } catch (e) {
          console.error("[whatsapp-webhook] could not record status event:", e);
        }
      }
      for (const m of change.value?.messages ?? []) {
        // Inbound message (someone replied) — not expected/needed for this
        // feature's outbound-only sends, logged for visibility only.
        console.log("[whatsapp-webhook] inbound message:", { from: m.from, id: m.id, type: m.type });
      }
    }
  }

  return NextResponse.json({ received: true });
}
