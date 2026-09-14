import "server-only";
import type { SessionPayload } from "../auth/session";
import type { Deal, DealSide } from "../types";
import { createDealWithBilling, type NewDealInput } from "../services/deals";
import type { CommissionInput, PersonInput, WizardDraft } from "./draft";
import type { ValidationIssue } from "./validation";
import type { WizardStep } from "./steps";
import {
  computeExpectedBillPreVat,
  computeNormalizedCommissionPercent,
  computeReferralNormalizedPercent,
} from "./commission";

/**
 * Bridges the wizard's rich, per-side draft onto agentLedger's own Deal
 * model — one row per BILLING relationship (one agent, one client side, one
 * commission rate), not one row per Monday item. This is new Phase 8d
 * plumbing; it does not change anything about how the wizard itself
 * collects or validates data (draft.ts/validation.ts/commission.ts are
 * untouched).
 *
 * - representation "owner" or "buyer" → one Deal, for that side.
 * - representation "both" → two Deals (this same agent earns commission on
 *   both the owner and the buyer relationship — they're billed separately).
 *   Each side is created and persisted (see review/actions.ts) one at a
 *   time specifically so a failure creating the second half never leaves
 *   the first half's Deal orphaned/un-resumable — a retry only (re)creates
 *   whichever side is still missing.
 * - A colleague named on the other-side step (otherSideRepresentedBy:
 *   "colleague") never gets a Deal created here — the wizard only ever
 *   collects that colleague's name/phone/email as free text (see
 *   party-form.tsx), never their agentLedger agentId, so there's nothing to
 *   attribute a Deal to. That colleague still submits their own wizard
 *   entry for their side, same as before this merge (no regression: the
 *   old Monday-only flow never auto-created the colleague's ledger entry
 *   either).
 */

export type WizardDealSideKind = "owner" | "buyer";

/** Which side(s) this draft's submission should produce an agentLedger Deal
 *  for, per its `representation` answer. */
export function wizardSidesToCreate(draft: WizardDraft): WizardDealSideKind[] {
  const kinds: WizardDealSideKind[] = [];
  if (draft.representation === "owner" || draft.representation === "both") {
    kinds.push("owner");
  }
  if (draft.representation === "buyer" || draft.representation === "both") {
    kinds.push("buyer");
  }
  return kinds;
}

// Steps shared by both sides (fundamental choices + property/price) count
// toward either deal's incompleteFields; side-specific steps only count
// toward that side's own deal.
const SHARED_STEPS: WizardStep[] = [
  "language",
  "deal-type",
  "representation",
  "property",
  "price-terms",
];

/** Creates the agentLedger Deal (+ opening Billing) for exactly one side of
 *  the draft. Call once per side in `wizardSidesToCreate(draft)` — see
 *  review/actions.ts for the per-side resume/idempotency handling. */
export async function createDealForSide(
  draft: WizardDraft,
  session: SessionPayload,
  issues: ValidationIssue[],
  kind: WizardDealSideKind,
): Promise<Deal> {
  const isRental = draft.dealType === "rental";
  const pdfStatus = issues.length === 0 ? "building_pdf" : "manual_steps_necessary";
  const isRelevant = (step: WizardStep) =>
    SHARED_STEPS.includes(step) || step.startsWith(kind);

  return buildAndCreateDeal({
    draft,
    session,
    side: kind === "owner" ? (isRental ? "landlord" : "seller") : isRental ? "renter" : "buyer",
    persons: (kind === "owner" ? draft.owners : draft.buyers) ?? [],
    commission: kind === "owner" ? draft.ownerCommission : draft.buyerCommission,
    pdfStatus,
    incompleteFields: issues.filter((i) => isRelevant(i.step)).map((i) => i.message),
  });
}

function personsClientName(persons: PersonInput[]): string {
  const names = persons.map((p) => p.name?.trim()).filter(Boolean);
  return names.length > 0 ? names.join(" ו- ") : "(שם חסר)";
}

function propertyAddressText(draft: WizardDraft): string | undefined {
  const p = draft.property;
  const parts = [
    p?.street,
    p?.buildingNumber,
    p?.apartmentNumber ? `דירה ${p.apartmentNumber}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : undefined;
}

/**
 * "% of THIS commission" (agentLedger's Deal.referralPercent contract) from
 * the wizard's own normalized, price-relative figures — computed via the
 * two sides' pre-VAT shekel amounts rather than a direct ratio of the raw
 * entered numbers, so it comes out right even when the main commission and
 * the referral used different units (%/₪) or different VAT-mode toggles
 * (each has its own, independent of the other — see commission.ts).
 */
function referralPercentOfCommission(
  commission: CommissionInput,
  price: number | undefined,
): number | undefined {
  const referral = commission.referral;
  if (!referral) return undefined;
  const mainPct = computeNormalizedCommissionPercent(commission, price);
  const mainBill = computeExpectedBillPreVat(mainPct, price);
  const referralPct = computeReferralNormalizedPercent(mainPct, referral, price);
  const referralBill = computeExpectedBillPreVat(referralPct, price);
  if (mainBill && referralBill !== null) {
    return (referralBill / mainBill) * 100;
  }
  // No price to derive shekel amounts from — a straight percentage referral
  // already IS "% of the commission" by definition; a shekel-flat referral
  // has no meaningful fallback without a price, so it's left unset (same as
  // the wizard's own UI, which can't show an expected bill either without one).
  return referral.unit === "percentage" ? referral.amount : undefined;
}

async function buildAndCreateDeal(opts: {
  draft: WizardDraft;
  session: SessionPayload;
  side: DealSide;
  persons: PersonInput[];
  commission: CommissionInput | undefined;
  pdfStatus: "building_pdf" | "manual_steps_necessary";
  incompleteFields: string[];
}): Promise<Deal> {
  const { draft, session, side, persons, commission, pdfStatus, incompleteFields } = opts;
  const price = draft.priceTerms?.price;

  const commissionPercent = commission
    ? (computeNormalizedCommissionPercent(commission, price) ?? 0)
    : 0;
  const hasReferral = !!commission?.referral;
  const referralPercent = commission
    ? referralPercentOfCommission(commission, price)
    : undefined;

  const input: NewDealInput = {
    officeId: session.officeId,
    agentId: session.agentId,
    agentName: session.agentName,
    team: session.team,
    dealType: draft.dealType ?? "sale",
    side,
    clientName: personsClientName(persons),
    propertyAddress: propertyAddressText(draft),
    salePrice: price ?? 0,
    commissionPercent,
    hasReferral,
    referralPercent,
    sikkumDate: new Date().toISOString().slice(0, 10),
    signingDate: draft.signingDate,
    // Fraud gate (ROADMAP §Phase 8): an agent-submitted deal never
    // self-advances past "potential", regardless of signingDate.
    forceStage: "potential",
    docLanguage: draft.language,
    otherSideRepresentedBy:
      draft.representation !== "both" ? draft.otherSideRepresentedBy : undefined,
    propertyId: draft.property?.selectedItemId ?? undefined,
    offerId: draft.selectedOfferId ?? undefined,
    pdfStatus,
    incompleteFields: incompleteFields.length > 0 ? incompleteFields : undefined,
  };

  return createDealWithBilling(input);
}
