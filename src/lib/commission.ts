import type { CommissionTierOverride, CommissionTierRule, Deal } from "./types";

export const VAT_RATE = 0.18;

/** Strip VAT from a VAT-inclusive figure. Sign-preserving. */
export function stripVat(amountInclVat: number): number {
  return Math.round((amountInclVat / (1 + VAT_RATE)) * 100) / 100;
}

/** Add VAT to a pre-VAT figure. Sign-preserving. */
export function addVat(amountExVat: number): number {
  return Math.round(amountExVat * (1 + VAT_RATE) * 100) / 100;
}

/**
 * The one correct "what is this deal worth" figure — pre-VAT, referral
 * subtracted. Replaces Red File's two disagreeing formulas (`total fee NEW`,
 * VAT-inclusive and referral-blind; `Office Commission`, referral-aware but
 * VAT-blind and folded together with the office/agent split in one step).
 */
export function computeDealValue(
  deal: Pick<Deal, "salePrice" | "commissionPercent" | "hasReferral" | "referralPercent">,
): number {
  const grossPreVat = deal.salePrice * (deal.commissionPercent / 100);
  if (deal.hasReferral && deal.referralPercent) {
    return grossPreVat * (1 - deal.referralPercent / 100);
  }
  return grossPreVat;
}

/**
 * The gross bill sent to the client — VAT-inclusive, referral NOT
 * subtracted (the client owes the full commission regardless of any
 * referral arrangement between the office and a third party).
 */
export function computeBillingAmount(
  deal: Pick<Deal, "salePrice" | "commissionPercent">,
): number {
  return deal.salePrice * (deal.commissionPercent / 100) * (1 + VAT_RATE);
}

/**
 * Marginal (bracket-blended) commission for a SPECIFIC deal, given the
 * agent's YTD income *before* this deal — mirrors how income-tax brackets
 * work, not a cliff-edge lookup. If the deal's value straddles a tier
 * threshold, only the portion above the threshold gets the higher rate.
 * An override bypasses bracket blending entirely (a permanent flat rate on
 * the whole deal), same as the old "Expense" board's formula did for the
 * two named agents.
 *
 * Verified against the worked example: an agent at ₪440k YTD closing a
 * ₪20k deal, tiers [0→50%, 450k→55%, 650k→60%] — the first ₪10k
 * (440k→450k) is at 50%, the second ₪10k (450k→460k) is at 55%:
 * 10000×0.5 + 10000×0.55 = 10500, a blended 52.5% for this specific deal.
 */
export function computeMarginalCommission(
  priorYtdIncome: number,
  dealValue: number,
  tiers: CommissionTierRule[],
  override?: CommissionTierOverride,
): number {
  if (override) return dealValue * override.flatAgentRate;
  if (dealValue <= 0) return 0;
  if (tiers.length === 0) return dealValue * 0.5;

  // Brackets are [thresholdIls, nextThresholdIls) → agentRate. Synthesize a
  // base bracket starting at 0 if the lowest tier isn't already there.
  const sorted = [...tiers].sort((a, b) => a.thresholdIls - b.thresholdIls);
  const brackets =
    sorted[0].thresholdIls === 0
      ? sorted
      : [{ thresholdIls: 0, agentRate: sorted[0].agentRate }, ...sorted];

  let remaining = dealValue;
  let cursor = priorYtdIncome;
  let commission = 0;

  for (let i = 0; i < brackets.length && remaining > 0; i++) {
    const bracketStart = brackets[i].thresholdIls;
    const bracketEnd = i + 1 < brackets.length ? brackets[i + 1].thresholdIls : Infinity;
    if (cursor >= bracketEnd) continue; // already past this bracket entirely
    const bracketRoom = bracketEnd - Math.max(cursor, bracketStart);
    const amountInBracket = Math.min(remaining, bracketRoom);
    if (amountInBracket <= 0) continue;
    commission += amountInBracket * brackets[i].agentRate;
    remaining -= amountInBracket;
    cursor += amountInBracket;
  }

  return commission;
}

/** The blended effective rate this deal got — commission ÷ dealValue.
 *  Useful for display ("52.5% effective rate on this deal"). */
export function computeMarginalRate(
  priorYtdIncome: number,
  dealValue: number,
  tiers: CommissionTierRule[],
  override?: CommissionTierOverride,
): number {
  if (dealValue <= 0) return 0;
  return computeMarginalCommission(priorYtdIncome, dealValue, tiers, override) / dealValue;
}
