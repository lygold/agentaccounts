import "server-only";
import { getRedis, RedisKeys } from "../redis";
import { SESSION_TTL_SECONDS } from "../auth/session";
import { advanceFurthest, type WizardStep } from "./steps";

/**
 * Ported from sikkumPigisha's src/lib/draft.ts — field shapes and merge
 * semantics are UNCHANGED (the wizard's own QA'd business logic must not
 * move). The only real change is the storage key: sikkumPigisha keyed by a
 * random draftId minted into its own session JWT; here we key by the
 * agentLedger session's `agentId` directly, since the agent is already
 * authenticated into a real hub session by the time they reach /sikkum —
 * no second auth system, no draftId to carry around. Same collision
 * protection either way: only that one agent can act as that agentId.
 *
 * One draft per agent. Read-modify-write the whole blob on each step —
 * drafts are small (a few KB) and never concurrently mutated by the same
 * user.
 */

export type Representation = "owner" | "buyer" | "both";
export type DealType = "sale" | "rental";
export type DocLanguage = "hebrew" | "english";
export type CommunicationLang = "hebrew" | "english";

export interface PersonInput {
  name: string;
  teudatZehut?: string;
  phone?: string;
  email?: string;
}

export interface PartyInput {
  name: string;
  phone?: string;
  email?: string;
}

export interface PropertyInput {
  /** Pulse ID of a selected property from the agent's listings, or null for
   *  manually entered. */
  selectedItemId: string | null;
  neighbourhood?: string;
  street?: string;
  buildingNumber?: string;
  apartmentNumber?: string;
  gushChelka?: string;
  rooms?: number;
  sizeSqm?: number;
}

export interface PriceTermsInput {
  price?: number;
  currency?: "ILS" | "USD";
  paymentTerms?: string;
  vacatingDate?: string; // ISO yyyy-mm-dd
}

/** Unit the agent chose to enter a commission amount in. "months" (months of
 *  rent) is only ever offered/used for rental deals. */
export type CommissionUnit = "percentage" | "shekel" | "months";
export type VatMode = "plus" | "included";

export interface ReferralInput {
  agentName: string;
  officeName?: string;
  phone: string;
  /** Referral has no "months" option — always a straight %-of-commission or
   *  a flat shekel amount, regardless of the main commission's own unit. */
  unit: "percentage" | "shekel";
  amount: number;
  vatMode: VatMode;
}

export interface CommissionInput {
  unit: CommissionUnit;
  amount: number;
  vatMode: VatMode;
  /** Internal only — never written to Monday as a column, never in the PDF.
   *  See src/lib/wizard/commission.ts for how this composes with the main
   *  commission's own normalized percentage ("25% of the 2%", not of price). */
  referral?: ReferralInput;
}

export interface WizardDraft {
  /** Furthest wizard step the user has reached. Used to bound back/forward
   *  navigation — they can revisit completed steps but can't skip ahead. */
  furthestStep: WizardStep;
  /** Doc-output language (page 4). Drives template selection on PDF gen. */
  language?: DocLanguage;
  dealType?: DealType;
  representation?: Representation;
  /** Only meaningful when representation isn't "both" — who represents the
   *  side this agent doesn't. Lets the Deals item still flag that side as
   *  represented when it's a colleague, so the office automation that adds
   *  sellers/buyers to the board doesn't skip it just because this agent
   *  personally only represents one side. */
  otherSideRepresentedBy?: "colleague" | "external";
  property?: PropertyInput;
  priceTerms?: PriceTermsInput;
  /** v1 hard-cap at 2; UI shows "more? email levi" copy. */
  owners?: PersonInput[];
  /** Internal only — never in the PDF. Maps to DEALS_BOARD.ownerCommission.*
   *  in Monday (a single normalized percentage column + referral contact
   *  columns; the raw entered figures go into a Monday update instead). */
  ownerCommission?: CommissionInput;
  /** Owner-side billing/communication language. Maps to color_mkqqxbp3 in Monday. */
  ownerCommunicationLang?: CommunicationLang;
  /** True when owners[0].teudatZehut was silently backfilled from a matching
   *  Signed Contracts seller/landlord record (Properties board has no ID
   *  column of its own). Shown as a notice on the owners step, then not
   *  persisted further — it's not written to Monday on submit. */
  ownerTeudatZehutAutofilled?: boolean;
  ownerLawyer?: PartyInput;
  ownerAgent?: PartyInput;
  buyers?: PersonInput[];
  /** Internal only — never in the PDF. Maps to DEALS_BOARD.buyerCommission.*
   *  in Monday, same shape as ownerCommission. Referral is never prefilled
   *  on this side (no board source exists) but the field/step still exists. */
  buyerCommission?: CommissionInput;
  /** Offers-board (הצעת מחיר) item id, set when a buyer suggestion sourced
   *  from that board was selected on the buyers step. Marked "Accepted" on
   *  that board once the deal is actually submitted — not at selection
   *  time, since the agent could still back out before submitting. */
  selectedOfferId?: string | null;
  /** Buyer-side billing/communication language. Maps to color_mkqqrnb7 in Monday. */
  buyerCommunicationLang?: CommunicationLang;
  buyerLawyer?: PartyInput;
  buyerAgent?: PartyInput;
  /** Expected signing date — internal office use only, not in PDF. ISO yyyy-mm-dd. */
  signingDate?: string;
  notes?: string;
  /** Internal notes to the office — not published in the PDF.
   *  Commission changes, referrals, anything the office needs to know. */
  officeNotes?: string;
  /** Not part of sikkumPigisha's own Draft — set by review/actions.ts
   *  (Phase 8d) right after each side's agentLedger Deal is created, keyed
   *  per side (not a flat list) so a retry — after a failed Monday mirror,
   *  or after only one side of a "both" submission succeeded — only
   *  (re)creates whatever's still missing, never a side that's already
   *  billed. Values are ids into agentLedger's own `deals` table. */
  submittedDeals?: { owner?: string; buyer?: string };
}

/** Empty draft used the first time an agent lands on the wizard. */
export function emptyDraft(): WizardDraft {
  return { furthestStep: "language" };
}

export async function loadDraft(agentId: string): Promise<WizardDraft> {
  const raw = await getRedis().get<WizardDraft | string>(RedisKeys.wizardDraft(agentId));
  if (!raw) return emptyDraft();
  // Upstash auto-parses JSON for typed gets, but be defensive in case it ever
  // hands back a string.
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as WizardDraft;
    } catch {
      return emptyDraft();
    }
  }
  return raw;
}

export async function saveDraft(agentId: string, draft: WizardDraft): Promise<void> {
  await getRedis().set(RedisKeys.wizardDraft(agentId), JSON.stringify(draft), {
    ex: SESSION_TTL_SECONDS,
  });
}

/** Merge a partial update into the existing draft and persist. */
export async function patchDraft(
  agentId: string,
  patch: Partial<WizardDraft>,
): Promise<WizardDraft> {
  const current = await loadDraft(agentId);
  const next: WizardDraft = { ...current, ...patch };
  await saveDraft(agentId, next);
  return next;
}

/**
 * Apply a step submission: merge the field patch AND advance `furthestStep`
 * forward (monotonically) given the step the user just completed.
 *
 * Every wizard page's server action should call this exactly once, after
 * validating its inputs.
 */
export async function advanceDraft(
  agentId: string,
  fromStep: WizardStep,
  patch: Partial<Omit<WizardDraft, "furthestStep">>,
): Promise<WizardDraft> {
  const current = await loadDraft(agentId);
  const next: WizardDraft = {
    ...current,
    ...patch,
    furthestStep: advanceFurthest(fromStep, current.furthestStep),
  };
  await saveDraft(agentId, next);
  return next;
}
