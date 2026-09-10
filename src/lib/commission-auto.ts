import "server-only";
import {
  computeBillingAmount,
  computeDealValue,
  computeMarginalCommission,
} from "./commission";
import { tiersForAgent } from "./commission-tiers";
import { listDealsByAgent } from "./store/deals";
import { listIncomeForDeal } from "./store/income";
import type { Deal, Income } from "./types";

const yearOf = (isoDate: string) => isoDate.slice(0, 4);

/**
 * Deal value recognised by a single income payment — its share of the
 * billed (VAT-inclusive) total, applied to the deal's pre-VAT,
 * referral-adjusted value. Summed across payments this is what feeds the
 * tier brackets.
 */
export function recognisedDealValue(deal: Deal, incomeAmount: number): number {
  const billed = computeBillingAmount(deal);
  if (billed <= 0) return 0;
  return (incomeAmount / billed) * computeDealValue(deal);
}

/**
 * Deal value the agent has already recognised from payments received
 * earlier in the same calendar year as `beforeDate` — the tier cursor
 * position before this payment. `excludeIncomeId` skips the row being
 * processed so a re-run is idempotent.
 */
export async function priorYtdDealValue(
  agentId: string,
  beforeDate: string,
  excludeIncomeId?: string,
  excludeDealId?: string,
): Promise<number> {
  const year = yearOf(beforeDate);
  const deals = await listDealsByAgent(agentId);
  let total = 0;
  for (const deal of deals) {
    if (deal.id === excludeDealId) continue;
    for (const row of await listIncomeForDeal(deal.id)) {
      if (row.id === excludeIncomeId) continue;
      if (yearOf(row.receivedDate) !== year) continue;
      if (row.receivedDate >= beforeDate) continue;
      total += recognisedDealValue(deal, row.amount);
    }
  }
  return total;
}

/**
 * What the agent would earn if this deal's full value pays out, at the
 * current commission %, bracket-blended on top of their YTD from every OTHER
 * deal this year. Pre-VAT. Shown on the deal page before any payment lands.
 */
export async function potentialCommission(deal: Deal): Promise<number> {
  const yearEnd = `${new Date().getFullYear()}-12-31`;
  const priorYtd = await priorYtdDealValue(deal.agentId, yearEnd, undefined, deal.id);
  return computeMarginalCommission(
    priorYtd,
    computeDealValue(deal),
    tiersForAgent(deal.agentId, deal.agentName),
  );
}

/**
 * The marginal (bracket-blended) commission an agent earns from one new
 * payment, given everything they've recognised earlier this year.
 */
export async function commissionForPayment(
  deal: Deal,
  income: Pick<Income, "id" | "amount" | "receivedDate">,
): Promise<number> {
  const prior = await priorYtdDealValue(deal.agentId, income.receivedDate, income.id);
  const thisValue = recognisedDealValue(deal, income.amount);
  return computeMarginalCommission(
    prior,
    thisValue,
    tiersForAgent(deal.agentId, deal.agentName),
  );
}
