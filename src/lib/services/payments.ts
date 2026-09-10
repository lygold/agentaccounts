import "server-only";
import type { AgentLedgerEntry, Income, PaymentStatus } from "../types";
import { getDeal, updateDeal } from "../store/deals";
import { createIncome, totalReceivedForDeal } from "../store/income";
import { createLedgerEntry } from "../store/agent-ledger";
import { addVat, computeBillingAmount } from "../commission";
import { commissionForPayment } from "../commission-auto";

/**
 * Client-payment operations. Recording a payment against a deal also posts
 * the agent's commission for it automatically (bracket-blended across their
 * YTD tier — see commission-auto.ts). No manual rate.
 */

export interface RecordPaymentInput {
  officeId: string;
  dealId: string;
  amount: number;
  receivedDate: string;
  /** Provenance — defaults to "manual" (keyed on the deal page). The GI
   *  webhook passes "webhook" + the originating gi-documents id + method. */
  source?: "app" | "webhook" | "manual";
  giDocId?: string;
  paymentMethod?: string;
}

/**
 * Record a client payment and auto-post the agent's commission credit.
 * `commissionForPayment` returns a pre-VAT figure (deal value is pre-VAT);
 * the ledger entry stores that plus its VAT-inclusive cash equivalent.
 * Returns null when the deal doesn't exist.
 */
export async function recordDealPayment(
  input: RecordPaymentInput,
): Promise<{ income: Income; commission: AgentLedgerEntry | null } | null> {
  const deal = await getDeal(input.dealId);
  if (!deal || deal.officeId !== input.officeId) return null;

  const income = await createIncome({
    officeId: input.officeId,
    dealId: input.dealId,
    amount: input.amount,
    receivedDate: input.receivedDate,
    source: input.source ?? "manual",
    giDocId: input.giDocId,
    paymentMethod: input.paymentMethod,
  });

  const commissionExVat = await commissionForPayment(deal, income);
  let commission: AgentLedgerEntry | null = null;
  if (commissionExVat > 0) {
    commission = await createLedgerEntry({
      officeId: input.officeId,
      agentId: deal.agentId,
      agentName: deal.agentName,
      type: "commission",
      amount: addVat(commissionExVat),
      amountExVat: commissionExVat,
      description: `Commission — ${deal.clientName} (${deal.propertyAddress ?? deal.dealType})`,
      dealId: input.dealId,
      date: input.receivedDate,
    });
  }

  // Roll the deal's payment status forward from total received vs. billed.
  // overdue / dead_debt are explicit manual flags, so leave those alone.
  if (deal.paymentStatus !== "overdue" && deal.paymentStatus !== "dead_debt") {
    const received = await totalReceivedForDeal(input.dealId);
    const billed = computeBillingAmount(deal);
    const next: PaymentStatus =
      received >= billed ? "paid" : received > 0 ? "partial_payment" : "due";
    if (next !== deal.paymentStatus) {
      await updateDeal(input.dealId, { paymentStatus: next }, input.officeId);
    }
  }

  return { income, commission };
}
