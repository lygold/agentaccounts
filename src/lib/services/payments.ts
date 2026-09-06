import "server-only";
import type { AgentLedgerEntry, Income } from "../types";
import { getDeal } from "../store/deals";
import { createIncome } from "../store/income";
import { createLedgerEntry } from "../store/agent-ledger";
import { addVat } from "../commission";
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
  if (!deal) return null;

  const income = await createIncome({
    officeId: input.officeId,
    dealId: input.dealId,
    amount: input.amount,
    receivedDate: input.receivedDate,
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
  return { income, commission };
}
