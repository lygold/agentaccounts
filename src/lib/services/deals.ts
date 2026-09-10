import "server-only";
import type { Deal, DealSide, DealType } from "../types";
import { createDeal, getDeal, updateDeal } from "../store/deals";
import { createBilling, listBillingForDeal, updateBilling } from "../store/billing";
import { putGiDocument } from "../store/gi-documents";
import { computeBillingAmount } from "../commission";
import {
  createGreenInvoiceClient,
  resolveGreenInvoiceClient,
  type ClientResolution,
} from "../green-invoice/clients";
import {
  createTransactionAccount,
  type GreenInvoiceDocument,
} from "../green-invoice/documents";

/**
 * Deal business operations — everything the deal actions used to do inline.
 * Plain functions: no auth, no FormData, no redirect. Server actions (and a
 * future WhatsApp handler) are thin callers. See the Agent Hub plan.
 */

export interface NewDealInput {
  officeId: string;
  agentId: string;
  agentName: string;
  team?: number | null;
  dealType: DealType;
  side: DealSide;
  clientName: string;
  propertyAddress?: string;
  salePrice: number;
  commissionPercent: number;
  hasReferral: boolean;
  referralPercent?: number;
  sikkumDate?: string;
  signingDate?: string;
}

/**
 * Create a deal and its opening billing record. The client is billed the
 * full gross (VAT-inclusive, referral NOT subtracted — an internal split
 * concern). Stage is "signed" when a signing date is given, else "potential".
 */
export async function createDealWithBilling(input: NewDealInput): Promise<Deal> {
  const deal = await createDeal({
    ...input,
    team: input.team ?? null,
    stage: input.signingDate ? "signed" : "potential",
    paymentStatus: "due",
  });
  await createBilling({
    officeId: input.officeId,
    dealId: deal.id,
    amount: computeBillingAmount(deal),
    issuedDate: new Date().toISOString().slice(0, 10),
  });
  return deal;
}

/**
 * Resolve (or begin resolving) the Green Invoice client for a deal. An
 * unambiguous match links the deal immediately; 2+ matches come back for a
 * human to pick. Returns null when the deal doesn't exist.
 */
export async function resolveGiClientForDeal(
  dealId: string,
  officeId: string,
): Promise<ClientResolution | null> {
  const deal = await getDeal(dealId);
  if (!deal || deal.officeId !== officeId) return null;
  const resolution = await resolveGreenInvoiceClient(deal.clientName);
  if (resolution.status === "resolved") {
    await updateDeal(dealId, { greenInvoiceClientId: resolution.clientId }, officeId);
  }
  return resolution;
}

/**
 * Finalise an ambiguous GI client match — an existing candidate id, or
 * "new" to create a fresh client from the deal's clientName. Returns the
 * linked client id, or null (deal missing or empty choice).
 */
export async function setGiClientForDeal(
  dealId: string,
  choice: string,
  officeId: string,
): Promise<string | null> {
  const deal = await getDeal(dealId);
  if (!deal || deal.officeId !== officeId) return null;
  let clientId: string;
  if (choice === "new") {
    clientId = (await createGreenInvoiceClient({ name: deal.clientName })).id;
  } else if (choice) {
    clientId = choice;
  } else {
    return null;
  }
  await updateDeal(dealId, { greenInvoiceClientId: clientId }, officeId);
  return clientId;
}

/**
 * Create the חשבון עסקה (300) for a deal's billing. No-op (returns null)
 * when the deal has no linked GI client, no billing row, or a 300 already
 * exists.
 */
export async function createDealTransactionAccount(
  dealId: string,
  officeId: string,
): Promise<GreenInvoiceDocument | null> {
  const deal = await getDeal(dealId);
  if (!deal || deal.officeId !== officeId || !deal.greenInvoiceClientId) return null;
  const billing = (await listBillingForDeal(dealId))[0];
  if (!billing || billing.greenInvoiceRef) return null;

  const doc = await createTransactionAccount({
    clientId: deal.greenInvoiceClientId,
    amount: billing.amount,
    description: `${deal.clientName} — ${deal.propertyAddress ?? deal.dealType}`,
    side: deal.side,
  });
  await updateBilling(billing.id, { greenInvoiceRef: doc.id }, officeId);

  // Record the 300 so the GI webhook can resolve a later 320/400 back to this
  // deal (see docs/mem/gi-webhook.md — resolution is by document link).
  await putGiDocument({
    id: doc.id,
    officeId,
    giType: 300,
    giNumber: Number(doc.number),
    giClientId: deal.greenInvoiceClientId,
    amount: billing.amount,
    linkedGiId: null,
    targetKind: "deal",
    dealId: deal.id,
    origin: "app",
  });
  return doc;
}

// createIncomeReceipt was removed in Phase 6: the app only ever creates 300s;
// Levi/Ariyel issue the 305/320/400 in Green Invoice, and the GI webhook
// (/api/green-invoice/webhook) turns those into income + commission.
