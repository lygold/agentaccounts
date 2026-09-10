import "server-only";
import type { Deal, GiDocType, GiDocumentRecord } from "../types";

/**
 * The Green Invoice document-processing logic, shared by the webhook route
 * (`/api/green-invoice/webhook`) and the scheduled poll fallback
 * (`/api/green-invoice/poll`). Dependencies are injected so it stays a plain
 * function. See docs/mem/gi-webhook.md for the payload shape + the chain.
 *
 *   300  → ignore (the app created it)
 *   305  → record; mark the deal invoiced (no income yet)
 *   320  → record; income + commission per payment; links straight to the 300
 *   400  → record; income + commission per payment; links to a 305 → then 300
 */

export interface GiWebhookDoc {
  id: string;
  type: number;
  number: number;
  currency?: string;
  total: number;
  subtotal?: number;
  recipient?: { id?: string };
  linkedDocuments?: Array<{ id: string; type: number }>;
  transactions?: Array<{
    id: string;
    price: number;
    date?: string;
    paymentMethod?: { type?: string };
  }>;
}

export interface HandlerDeps {
  getGiDocument: (id: string) => Promise<GiDocumentRecord | null>;
  putGiDocument: (
    input: Omit<GiDocumentRecord, "createdAt" | "updatedAt"> &
      Partial<Pick<GiDocumentRecord, "createdAt">>,
  ) => Promise<GiDocumentRecord>;
  getDeal: (id: string) => Promise<Deal | null>;
  recordDealPayment: (input: {
    officeId: string;
    dealId: string;
    amount: number;
    receivedDate: string;
    source?: "app" | "webhook" | "manual";
    giDocId?: string;
    paymentMethod?: string;
  }) => Promise<unknown>;
  fetchGiDocument: (
    id: string,
  ) => Promise<{ linkedDocuments?: Array<{ id: string; type: number }> }>;
}

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Walk `linkedDocuments` up the chain to the 300's `gi-documents` record.
 * 320 → 300 (one hop). 400 → 305 → 300 (two hops); the intermediate 305 is
 * read from our own table if we've seen it, else fetched from the GI API.
 */
async function resolveTo300(
  doc: GiWebhookDoc,
  deps: HandlerDeps,
): Promise<GiDocumentRecord | null> {
  let next = doc.linkedDocuments?.[0];
  const seen = new Set<string>([doc.id]);

  while (next && !seen.has(next.id)) {
    seen.add(next.id);
    if (next.type === 300) return deps.getGiDocument(next.id);

    const known = await deps.getGiDocument(next.id);
    if (known?.linkedGiId) {
      next = { id: known.linkedGiId, type: 300 };
      continue;
    }
    try {
      const parent = await deps.fetchGiDocument(next.id);
      next =
        parent.linkedDocuments?.find((l) => l.type === 300) ??
        parent.linkedDocuments?.[0];
    } catch {
      return null;
    }
  }
  return null;
}

export async function processGiDocument(
  doc: GiWebhookDoc,
  deps: HandlerDeps,
): Promise<void> {
  const type = doc.type as GiDocType;
  if (type === 300) return; // the app created it; nothing to do

  // Durable idempotency backstop (on top of the route's Redis guard): if this
  // receipt is already recorded, we've processed it.
  if (await deps.getGiDocument(doc.id)) {
    console.log(`[gi-webhook] ${type} ${doc.number} already recorded — skipping`);
    return;
  }

  const target = await resolveTo300(doc, deps);
  if (!target) {
    console.warn(
      `[gi-webhook] ${type} #${doc.number} — could not resolve to a 300; ` +
        `linked=${JSON.stringify(doc.linkedDocuments ?? [])}`,
    );
    return;
  }

  await deps.putGiDocument({
    id: doc.id,
    officeId: target.officeId,
    giType: type,
    giNumber: doc.number,
    giClientId: doc.recipient?.id ?? target.giClientId,
    amount: doc.total,
    linkedGiId: doc.linkedDocuments?.[0]?.id ?? null,
    targetKind: target.targetKind,
    dealId: target.dealId,
    agentId: target.agentId,
    expenseEntryIds: target.expenseEntryIds,
    origin: "webhook",
  });

  if (target.targetKind !== "deal" || !target.dealId) {
    // agent-expenses target — wired in the Phase 6 agent-expense-billing work.
    console.log(
      `[gi-webhook] ${type} #${doc.number} → target ${target.targetKind} (not yet handled)`,
    );
    return;
  }

  if (type === 305) {
    console.log(
      `[gi-webhook] 305 #${doc.number} → deal ${target.dealId} invoiced ₪${doc.total} (awaiting payment)`,
    );
    return;
  }

  // 320 / 400 — money received. One income row per payment transaction;
  // recordDealPayment posts commission and rolls paymentStatus forward.
  const deal = await deps.getDeal(target.dealId);
  if (!deal) {
    console.warn(`[gi-webhook] deal ${target.dealId} no longer exists`);
    return;
  }

  const txns =
    doc.transactions && doc.transactions.length > 0
      ? doc.transactions
      : [{ id: doc.id, price: doc.total, date: today() }];

  for (const txn of txns) {
    await deps.recordDealPayment({
      officeId: deal.officeId,
      dealId: deal.id,
      amount: txn.price,
      receivedDate: (txn.date ?? "").slice(0, 10) || today(),
      source: "webhook",
      giDocId: doc.id,
      paymentMethod: txn.paymentMethod?.type,
    });
  }
  console.log(
    `[gi-webhook] ${type} #${doc.number} → deal ${deal.id}: ${txns.length} payment(s) totalling ₪${doc.total}`,
  );
}
