"use server";

import { redirect } from "next/navigation";
import { requireManager } from "@/lib/auth/session-cookie";
import { DealSchema, IncomeEntrySchema } from "@/lib/form-parse";
import { DOCUMENT_TYPE, type ReceiptDocumentType } from "@/lib/green-invoice/documents";
import {
  createDealTransactionAccount,
  createDealWithBilling,
  createIncomeReceipt,
  resolveGiClientForDeal,
  setGiClientForDeal,
} from "@/lib/services/deals";
import { recordDealPayment } from "@/lib/services/payments";
import { isNextJsRedirect } from "@/lib/action-utils";

export async function submitNewDeal(formData: FormData) {
  try {
    const session = await requireManager();
    const parsed = DealSchema.safeParse({
      agentName: formData.get("agentName"),
      dealType: formData.get("dealType"),
      side: formData.get("side"),
      clientName: formData.get("clientName"),
      propertyAddress: formData.get("propertyAddress") || undefined,
      salePrice: formData.get("salePrice"),
      commissionPercent: formData.get("commissionPercent"),
      hasReferral: formData.get("hasReferral") === "on",
      referralPercent: formData.get("referralPercent") || undefined,
      sikkumDate: formData.get("sikkumDate") || undefined,
      signingDate: formData.get("signingDate") || undefined,
    });
    if (!parsed.success) return;

    // TODO(phase-3): agentId is still the typed name, not a real Daf Kesher
    // id — this manual-entry form predates Monday-backed identity and needs
    // a real agent picker once role-scoped creation is designed.
    const agentName = parsed.data.agentName.trim();
    const deal = await createDealWithBilling({
      officeId: session.officeId,
      agentId: agentName,
      agentName,
      dealType: parsed.data.dealType,
      side: parsed.data.side,
      clientName: parsed.data.clientName,
      propertyAddress: parsed.data.propertyAddress,
      salePrice: parsed.data.salePrice,
      commissionPercent: parsed.data.commissionPercent,
      hasReferral: parsed.data.hasReferral,
      referralPercent: parsed.data.referralPercent,
      sikkumDate: parsed.data.sikkumDate,
      signingDate: parsed.data.signingDate,
    });

    redirect(`/deals/${deal.id}`);
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("submitNewDeal failed:", e);
    redirect("/deals?error=save");
  }
}

/**
 * Log a client payment against a deal — auto-posts the agent's commission
 * (see services/payments.ts). No manual rate.
 */
export async function submitIncome(dealId: string, formData: FormData) {
  try {
    const session = await requireManager();
    const parsed = IncomeEntrySchema.safeParse({
      amount: formData.get("amount"),
      receivedDate: formData.get("receivedDate"),
    });
    if (!parsed.success) return;

    await recordDealPayment({
      officeId: session.officeId,
      dealId,
      amount: parsed.data.amount,
      receivedDate: parsed.data.receivedDate,
    });

    redirect(`/deals/${dealId}`);
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("submitIncome failed:", e);
    redirect(`/deals/${dealId}?error=save`);
  }
}

/**
 * Search Green Invoice for a client matching this deal's clientName. 0/1
 * matches resolve immediately; 2+ redirects back with the candidates in the
 * query string so the page can render a pick-or-create form.
 */
export async function searchGreenInvoiceClientForDeal(dealId: string) {
  try {
    await requireManager();
    const resolution = await resolveGiClientForDeal(dealId);
    if (!resolution || resolution.status === "resolved") {
      redirect(`/deals/${dealId}`);
    } else {
      const encoded = encodeURIComponent(JSON.stringify(resolution.candidates));
      redirect(`/deals/${dealId}?giCandidates=${encoded}`);
    }
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("searchGreenInvoiceClientForDeal failed:", e);
    redirect(`/deals/${dealId}?error=save`);
  }
}

/** Finalizes an ambiguous client match — either an existing candidate's id, or "new". */
export async function confirmGreenInvoiceClient(dealId: string, formData: FormData) {
  try {
    await requireManager();
    const choice = formData.get("clientChoice");
    if (typeof choice === "string") {
      await setGiClientForDeal(dealId, choice);
    }
    redirect(`/deals/${dealId}`);
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("confirmGreenInvoiceClient failed:", e);
    redirect(`/deals/${dealId}?error=save`);
  }
}

/** Manually-triggered — creates the חשבון עסקה (300) for this deal's billing. */
export async function createTransactionAccountForDeal(dealId: string) {
  try {
    await requireManager();
    await createDealTransactionAccount(dealId);
    redirect(`/deals/${dealId}`);
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("createTransactionAccountForDeal failed:", e);
    redirect(`/deals/${dealId}?error=save`);
  }
}

const RECEIPT_DOCUMENT_TYPES: ReceiptDocumentType[] = [
  DOCUMENT_TYPE.taxInvoice,
  DOCUMENT_TYPE.taxInvoiceReceipt,
  DOCUMENT_TYPE.receipt,
];

/** Manually-triggered — creates a חשבונית מס / חשבונית מס-קבלה / קבלה for
 *  one income row, linked back to the deal's 300. Levi/Ariyel pick the
 *  type at the moment the payment is confirmed. */
export async function createReceiptForIncome(
  dealId: string,
  incomeId: string,
  formData: FormData,
) {
  try {
    await requireManager();
    const typeRaw = Number(formData.get("documentType"));
    if (!RECEIPT_DOCUMENT_TYPES.includes(typeRaw as ReceiptDocumentType)) return;

    await createIncomeReceipt(dealId, incomeId, typeRaw as ReceiptDocumentType);
    redirect(`/deals/${dealId}`);
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("createReceiptForIncome failed:", e);
    redirect(`/deals/${dealId}?error=save`);
  }
}
