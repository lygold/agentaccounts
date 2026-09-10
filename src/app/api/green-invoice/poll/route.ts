import { NextResponse } from "next/server";
import { getDeal } from "@/lib/store/deals";
import { getGiDocument, putGiDocument } from "@/lib/store/gi-documents";
import { recordDealPayment } from "@/lib/services/payments";
import { greenInvoiceFetch } from "@/lib/green-invoice/client";
import {
  processGiDocument,
  type GiWebhookDoc,
} from "@/lib/green-invoice/webhook-handler";

/**
 * Green Invoice poll fallback — a backstop for webhook deliveries GI drops.
 * Lists recent documents, and runs any receipt (305/320/400) the webhook
 * handler hasn't already recorded through the same processing path.
 *
 *   curl -X POST https://<host>/api/green-invoice/poll \
 *        -H "Authorization: Bearer $SYNC_SECRET"
 *
 * Meant for a daily cron (see .github/workflows/). Safe to run any time —
 * `processGiDocument` no-ops on documents already in `gi-documents`.
 */

const LOOKBACK_DAYS = 4;
const RECEIPT_TYPES = new Set([305, 320, 400]);

interface SearchResponse {
  items?: Array<{ id: string; type: number; number: number }>;
}

export async function POST(request: Request) {
  const secret = process.env.SYNC_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "SYNC_SECRET not configured" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const fromDate = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000)
    .toISOString()
    .slice(0, 10);

  let items: SearchResponse["items"] = [];
  try {
    const res = await greenInvoiceFetch<SearchResponse>("/documents/search", {
      method: "POST",
      body: JSON.stringify({ fromDate, pageSize: 100, sort: "creationDate" }),
    });
    items = res.items ?? [];
  } catch (e) {
    console.error("[gi-poll] document search failed:", e);
    return NextResponse.json({ error: "search failed" }, { status: 502 });
  }

  const result = { scanned: items.length, candidates: 0, processed: 0, errors: 0 };

  for (const item of items) {
    if (!RECEIPT_TYPES.has(item.type)) continue;
    if (await getGiDocument(item.id)) continue; // already handled
    result.candidates++;
    try {
      const full = (await greenInvoiceFetch(`/documents/${item.id}`)) as GiWebhookDoc;
      await processGiDocument(full, {
        getGiDocument,
        putGiDocument,
        getDeal,
        recordDealPayment,
        fetchGiDocument: (id) =>
          greenInvoiceFetch(`/documents/${id}`) as Promise<{
            linkedDocuments?: Array<{ id: string; type: number }>;
          }>,
      });
      result.processed++;
    } catch (e) {
      result.errors++;
      console.error(`[gi-poll] ${item.type} #${item.number} failed:`, e);
    }
  }

  console.log("[gi-poll]", JSON.stringify(result));
  return NextResponse.json(result);
}
