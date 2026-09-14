import type { CommissionInput, ReferralInput } from "./draft";

/**
 * Israel's standard VAT rate. No settings/config mechanism exists in this
 * app for values like this — if the real-world rate ever changes, this
 * constant needs a manual update.
 */
export const VAT_RATE = 0.18;

/** "2 אחוז" / "1.5 אחוז" -> 2 / 1.5. Returns null on no match — Monday text
 *  data isn't guaranteed clean, never throw on it. */
export function parsePercentText(text: string | null | undefined): number | null {
  if (!text) return null;
  const m = /^(\d+(?:\.\d+)?)\s*אחוז/.exec(text.trim());
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

/** "1 חודשי שכירות" -> 1. Same non-throwing contract as parsePercentText. */
export function parseMonthsText(text: string | null | undefined): number | null {
  if (!text) return null;
  const m = /^(\d+(?:\.\d+)?)\s*חודשי\s*שכירות/.exec(text.trim());
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

/**
 * Normalizes whatever the agent entered (%, ₪, or — rentals only — months of
 * rent) into a single "percentage of price, pre-VAT-equivalent" figure. This
 * is the ONLY commission value ever written to a Monday column; everything
 * else the agent entered goes into a Monday update instead.
 *
 * `price` is draft.priceTerms.price — for rental deals this is the monthly
 * rent, which is what makes the "months" unit's math work out (N months of
 * rent, as a percentage of the monthly rent itself, is always N * 100).
 *
 * Returns null when price is missing (nothing to compute against) except in
 * "months" mode, which doesn't need price at all.
 */
export function computeNormalizedCommissionPercent(
  commission: Pick<CommissionInput, "unit" | "amount" | "vatMode">,
  price: number | undefined,
): number | null {
  const { unit, amount, vatMode } = commission;

  let rawPct: number | null;
  if (unit === "percentage") {
    rawPct = amount;
  } else if (unit === "shekel") {
    if (!price) return null;
    rawPct = (amount / price) * 100;
  } else {
    // months of rent — rentals only, price not needed for this branch.
    rawPct = amount * 100;
  }

  if (rawPct === null) return null;
  return vatMode === "plus" ? rawPct : rawPct / (1 + VAT_RATE);
}

/**
 * Referral is a cut of the MAIN commission's already-normalized percentage
 * ("25% of the 2%"), not a percentage of price — confirmed explicitly by the
 * user. Referral has its own independent plus/incl-VAT toggle, applied on
 * top of that cut, the same way the main commission's own VAT toggle applies
 * to its raw figure.
 */
export function computeReferralNormalizedPercent(
  mainNormalizedPct: number | null,
  referral: Pick<ReferralInput, "unit" | "amount" | "vatMode">,
  price: number | undefined,
): number | null {
  let rawReferralPct: number | null;
  if (referral.unit === "percentage") {
    if (mainNormalizedPct === null) return null;
    rawReferralPct = mainNormalizedPct * (referral.amount / 100);
  } else {
    if (!price) return null;
    rawReferralPct = (referral.amount / price) * 100;
  }

  return referral.vatMode === "plus" ? rawReferralPct : rawReferralPct / (1 + VAT_RATE);
}

/** Live UI readout only — the pre-VAT shekel amount a normalized percentage
 *  represents against the deal price. Not written to Monday itself. */
export function computeExpectedBillPreVat(
  normalizedPct: number | null,
  price: number | undefined,
): number | null {
  if (normalizedPct === null || !price) return null;
  return (price * normalizedPct) / 100;
}

/** "{agentName}, Office Name: {officeName}" for the combined refName_Own /
 *  refName_Buy Monday column — drops the office suffix entirely when unset. */
export function formatReferralContact(referral: Pick<ReferralInput, "agentName" | "officeName">): string {
  return referral.officeName
    ? `${referral.agentName}, Office Name: ${referral.officeName}`
    : referral.agentName;
}
