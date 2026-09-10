import "server-only";
import { greenInvoiceFetch } from "./client";
import { REMARKS_TEMPLATES } from "./remarks-templates";
import { VAT_RATE } from "../commission";
import type { DealSide } from "../types";

/** Numeric document-type codes, confirmed against the real API docs. */
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

export type ReceiptDocumentType =
  | typeof DOCUMENT_TYPE.taxInvoice
  | typeof DOCUMENT_TYPE.taxInvoiceReceipt
  | typeof DOCUMENT_TYPE.receipt;

/** PaymentGroup codes, confirmed against the real API docs. */
export const PAYMENT_TYPE = {
  cash: 1,
  check: 2,
  creditCard: 3,
  bankTransfer: 4,
  paypal: 5,
  paymentApp: 10,
  other: 11,
} as const;

export interface GreenInvoiceDocument {
  id: string;
  number: string;
  type: number;
  url?: { origin?: string; he?: string; en?: string };
}

interface CreateDocumentInput {
  type: number;
  clientId: string;
  amount: number;
  description: string;
  remarks?: string;
  linkedDocumentIds?: string[];
  /** Required by the API for receipt-type documents (305/320/400) — a
   *  receipt is proof of a specific payment, not just a line-item bill.
   *  Confirmed live: omitting this produced "נא למלא לפחות שורת תקבולים
   *  אחת" (please fill in at least one payment row), 2026-08-23. Not
   *  needed for type 300, which isn't tied to an actual payment yet. */
  payment?: { date: string; type: number };
}

async function createDocument(input: CreateDocumentInput): Promise<GreenInvoiceDocument> {
  // income[].price is pre-VAT — Green Invoice adds VAT on top itself (vatType
  // 0 = taxable). input.amount is always the VAT-inclusive total (what the
  // client actually paid/owes), so it has to be converted back down here;
  // otherwise VAT gets applied twice and, for receipt-type documents, the
  // computed income total no longer matches payment[].price — confirmed
  // live: "קיים חוסר התאמה בין סכום התקבולים לסכום התשלומים" (mismatch
  // between income total and payment total), 2026-08-23.
  const preVatPrice = input.amount / (1 + VAT_RATE);

  return greenInvoiceFetch<GreenInvoiceDocument>("/documents", {
    method: "POST",
    body: JSON.stringify({
      type: input.type,
      lang: "he",
      // Required at the document level, not just per line-item — omitting
      // this produced a live "ערך קוד מטבע לא תקין" (invalid currency code)
      // error from the sandbox API, confirmed 2026-08-23.
      currency: "ILS",
      client: { id: input.clientId },
      income: [
        {
          description: input.description,
          quantity: 1,
          price: preVatPrice,
          currency: "ILS",
          vatType: 0,
        },
      ],
      ...(input.remarks ? { remarks: input.remarks } : {}),
      ...(input.linkedDocumentIds
        ? { linkedDocumentIds: input.linkedDocumentIds, linkType: "link" }
        : {}),
      ...(input.payment
        ? {
            payment: [
              {
                date: input.payment.date,
                type: input.payment.type,
                // Payment price IS the VAT-inclusive total actually paid —
                // must match the income total (pre-VAT + computed VAT), not
                // the pre-VAT figure.
                price: input.amount,
                currency: "ILS",
              },
            ],
          }
        : {}),
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

/** חשבון עסקה (300) — the first document in the chain, manually triggered
 *  from the deal's billing screen. Remarks text is role-specific per the
 *  deal's side (seller/buyer/renter/landlord). */
export async function createTransactionAccount(opts: {
  clientId: string;
  amount: number;
  description: string;
  side: DealSide;
}): Promise<GreenInvoiceDocument> {
  return createDocument({
    type: DOCUMENT_TYPE.transactionAccount,
    clientId: opts.clientId,
    amount: opts.amount,
    description: opts.description,
    remarks: REMARKS_TEMPLATES[opts.side],
  });
}

/** חשבונית מס (305) / חשבונית מס-קבלה (320) / קבלה (400) — created later
 *  when a client payment is confirmed, linked back to the original 300 so
 *  Green Invoice's own document trail shows the relationship. Defaults the
 *  payment method to bank transfer — the realistic default for real-estate
 *  commission payments — override paymentType if it was actually cash/check/etc. */
export async function createReceiptDocument(opts: {
  type: ReceiptDocumentType;
  clientId: string;
  amount: number;
  description: string;
  linkedTransactionAccountId: string;
  paymentDate: string;
  paymentType?: number;
}): Promise<GreenInvoiceDocument> {
  return createDocument({
    type: opts.type,
    clientId: opts.clientId,
    amount: opts.amount,
    description: opts.description,
    linkedDocumentIds: [opts.linkedTransactionAccountId],
    payment: { date: opts.paymentDate, type: opts.paymentType ?? PAYMENT_TYPE.bankTransfer },
  });
}
