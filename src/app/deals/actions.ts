"use server";

import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session-cookie";
import { DealSchema, IncomeEntrySchema } from "@/lib/form-parse";
import { createDeal, getDeal, updateDeal } from "@/lib/store/deals";
import { createBilling, listBillingForDeal, updateBilling } from "@/lib/store/billing";
import { createIncome, getIncome, totalReceivedForDeal, updateIncome } from "@/lib/store/income";
import { createLedgerEntry } from "@/lib/store/agent-ledger";
import { computeBillingAmount, computeDealValue } from "@/lib/commission";
import {
  createGreenInvoiceClient,
  resolveGreenInvoiceClient,
} from "@/lib/green-invoice/clients";
import {
  createReceiptDocument,
  createTransactionAccount,
  DOCUMENT_TYPE,
  type ReceiptDocumentType,
} from "@/lib/green-invoice/documents";
import { isNextJsRedirect } from "@/lib/action-utils";

export async function submitNewDeal(formData: FormData) {
  try {
    await requireSession();
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
    // id — this manual-entry form predates Phase 2's Monday-backed identity
    // and needs a real agent picker once role-scoped creation is designed.
    const agentName = parsed.data.agentName.trim();
    const deal = await createDeal({
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
      stage: parsed.data.signingDate ? "signed" : "potential",
      paymentStatus: "due",
    });

    // Bill the client the full gross amount — referral not subtracted here,
    // that's an internal office/agent split concern (computeDealValue).
    await createBilling({
      dealId: deal.id,
      amount: computeBillingAmount(deal),
      issuedDate: new Date().toISOString().slice(0, 10),
    });

    redirect(`/deals/${deal.id}`);
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("submitNewDeal failed:", e);
    redirect("/deals?error=save");
  }
}

export async function submitIncome(dealId: string, formData: FormData) {
  try {
    await requireSession();
    const parsed = IncomeEntrySchema.safeParse({
      amount: formData.get("amount"),
      receivedDate: formData.get("receivedDate"),
    });
    if (!parsed.success) return;

    // greenInvoiceReceiptRef is filled in later, by createReceiptForIncome
    // below — Green Invoice is the source of that id now, not hand typed.
    await createIncome({ dealId, ...parsed.data });
    redirect(`/deals/${dealId}`);
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("submitIncome failed:", e);
    redirect(`/deals/${dealId}?error=save`);
  }
}

/**
 * Post a commission credit to the agent's ledger for everything received
 * on this deal so far, at the given rate — a manual Phase 1 stand-in for
 * the Phase 4 automatic tier rollup.
 */
export async function postCommission(dealId: string, formData: FormData) {
  try {
    await requireSession();
    const deal = await getDeal(dealId);
    if (!deal) return;

    const agentRate = Number(formData.get("agentRate"));
    if (!Number.isFinite(agentRate) || agentRate <= 0) return;

    const received = await totalReceivedForDeal(dealId);
    const dealValue = computeDealValue(deal);
    // Proportion of the deal's value actually received so far.
    const billed = computeBillingAmount(deal);
    const receivedShare = billed > 0 ? Math.min(received / billed, 1) : 0;
    const commissionAmount = dealValue * receivedShare * agentRate;

    await createLedgerEntry({
      agentId: deal.agentId,
      agentName: deal.agentName,
      type: "commission",
      amount: commissionAmount,
      description: `Commission — ${deal.clientName} (${(agentRate * 100).toFixed(0)}% of received)`,
      dealId,
      date: new Date().toISOString().slice(0, 10),
    });

    redirect(`/deals/${dealId}`);
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("postCommission failed:", e);
    redirect(`/deals/${dealId}?error=save`);
  }
}

/**
 * Search Green Invoice for a client matching this deal's clientName. 0/1
 * matches resolve immediately; 2+ redirects back with the candidates in
 * the query string so the page can render a pick-or-create form — never
 * auto-guess which existing client record to attach documents to.
 */
export async function searchGreenInvoiceClientForDeal(dealId: string) {
  try {
    await requireSession();
    const deal = await getDeal(dealId);
    if (!deal) return;

    const resolution = await resolveGreenInvoiceClient(deal.clientName);
    if (resolution.status === "resolved") {
      await updateDeal(dealId, { greenInvoiceClientId: resolution.clientId });
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
    await requireSession();
    const deal = await getDeal(dealId);
    if (!deal) return;

    const choice = formData.get("clientChoice");
    let clientId: string;
    if (choice === "new") {
      const created = await createGreenInvoiceClient({ name: deal.clientName });
      clientId = created.id;
    } else if (typeof choice === "string" && choice) {
      clientId = choice;
    } else {
      return;
    }

    await updateDeal(dealId, { greenInvoiceClientId: clientId });
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
    await requireSession();
    const deal = await getDeal(dealId);
    if (!deal || !deal.greenInvoiceClientId) return;

    const billingRows = await listBillingForDeal(dealId);
    const billing = billingRows[0];
    if (!billing || billing.greenInvoiceRef) return;

    const doc = await createTransactionAccount({
      clientId: deal.greenInvoiceClientId,
      amount: billing.amount,
      description: `${deal.clientName} — ${deal.propertyAddress ?? deal.dealType}`,
      side: deal.side,
    });
    await updateBilling(billing.id, { greenInvoiceRef: doc.id });
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
    await requireSession();
    const deal = await getDeal(dealId);
    if (!deal || !deal.greenInvoiceClientId) return;

    const billingRows = await listBillingForDeal(dealId);
    const billing = billingRows[0];
    if (!billing?.greenInvoiceRef) return;

    const income = await getIncome(incomeId);
    if (!income || income.dealId !== dealId || income.greenInvoiceReceiptRef) return;

    const typeRaw = Number(formData.get("documentType"));
    if (!RECEIPT_DOCUMENT_TYPES.includes(typeRaw as ReceiptDocumentType)) return;

    const doc = await createReceiptDocument({
      type: typeRaw as ReceiptDocumentType,
      clientId: deal.greenInvoiceClientId,
      amount: income.amount,
      description: `${deal.clientName} — payment ${income.receivedDate}`,
      linkedTransactionAccountId: billing.greenInvoiceRef,
      paymentDate: income.receivedDate,
    });
    await updateIncome(incomeId, { greenInvoiceReceiptRef: doc.id });
    redirect(`/deals/${dealId}`);
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("createReceiptForIncome failed:", e);
    redirect(`/deals/${dealId}?error=save`);
  }
}
