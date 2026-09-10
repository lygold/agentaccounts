import "server-only";
import { greenInvoiceFetch } from "./client";
import { GI_CONSULTING_ITEM, consultingLineDescription } from "./gi-items";
import { VAT_RATE } from "../commission";
import type { DealSide } from "../types";

/** Numeric document-type codes, confirmed against the real API + live docs. */
export const DOCUMENT_TYPE = {
  /** חשבון עסקה */
  transactionAccount: 300,
  /** חשבונית מס */
  taxInvoice: 305,
  /** חשבונית מס / קבלה */
  taxInvoiceReceipt: 320,
  /** קבלה */
  receipt: 400,
} as const;

export interface GreenInvoiceDocument {
  id: string;
  number: string;
  type: number;
  url?: { origin?: string; he?: string; en?: string };
}

/**
 * חשבון עסקה (300) — the only document the app creates. Levi/Ariyel issue the
 * 305/320/400 in Green Invoice; the webhook turns those into income. The line
 * uses the deal side's catalog מק"ט + a templated description (address + the
 * property price); the line's own price is the commission, pre-VAT (GI adds
 * VAT via vatType 0). `amount` is the VAT-inclusive commission total.
 */
export async function createTransactionAccount(opts: {
  clientId: string;
  amount: number;
  side: DealSide;
  propertyAddress: string | undefined;
  propertyPrice: number;
}): Promise<GreenInvoiceDocument> {
  const preVatPrice = opts.amount / (1 + VAT_RATE);

  return greenInvoiceFetch<GreenInvoiceDocument>("/documents", {
    method: "POST",
    body: JSON.stringify({
      type: DOCUMENT_TYPE.transactionAccount,
      lang: "he", // wizard supplies the real doc language in Phase 8
      // currency is required at the document level, not just per line —
      // omitting it gave "ערך קוד מטבע לא תקין" live (2026-08-23).
      currency: "ILS",
      client: { id: opts.clientId },
      income: [
        {
          catalogNum: GI_CONSULTING_ITEM[opts.side].catalogNum,
          description: consultingLineDescription(
            opts.side,
            opts.propertyAddress,
            opts.propertyPrice,
          ),
          quantity: 1,
          price: preVatPrice,
          currency: "ILS",
          vatType: 0,
        },
      ],
    }),
  });
}

/**
 * Email an existing document's PDF to one or more addresses. Repeatable —
 * Levi sends the 300 to the agent before signing, to the client after, etc.
 * `POST /documents/{id}/distribute` with `{ recipients: [...] }`, verified
 * live against the sandbox 2026-09-10 (returns 200 `{}`; GI rejects
 * non-deliverable domains like example.com).
 */
export async function distributeDocument(
  documentId: string,
  recipients: string[],
): Promise<void> {
  const clean = [...new Set(recipients.map((r) => r.trim()).filter(Boolean))];
  if (clean.length === 0) return;
  await greenInvoiceFetch(`/documents/${documentId}/distribute`, {
    method: "POST",
    body: JSON.stringify({ recipients: clean }),
  });
}
