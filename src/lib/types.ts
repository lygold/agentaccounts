/**
 * Core data model — see the approved roadmap plan for the full rationale.
 * agentId is a Daf Kesher (Monday) pulse/item ID as of Phase 2 — same
 * identity sikkumPigisha's own MONDAY_AGENTS_BOARD_ID resolves against.
 */

export type DealType = "sale" | "rental";
export type DealSide = "seller" | "buyer" | "landlord" | "renter";

/** Business lifecycle — agent-advanceable (potential→signed only).
 *  Deliberately separate from PaymentStatus below: Red File conflated
 *  "where is this deal in its lifecycle" with "is the client behind on
 *  paying" into one Status column, which is exactly the confusion this
 *  split is meant to fix. */
export type DealStage = "potential" | "signed" | "cancelled";

/** Client-payment status — derived from Billing vs. Income where possible
 *  (received=0 → due, 0<received<billed → partial_payment, received>=billed
 *  → paid), with overdue/dead_debt as explicit admin/manager flags. */
export type PaymentStatus = "due" | "partial_payment" | "paid" | "overdue" | "dead_debt";

export interface Deal {
  id: string;
  /** Which office this deal belongs to — see src/lib/office.ts. Single
   *  fixed value today; exists from day one so a second office is a new
   *  value, not a backfill. */
  officeId: string;
  agentId: string;
  agentName: string;
  dealType: DealType;
  side: DealSide;
  clientName: string;
  propertyAddress?: string;
  salePrice: number;
  /** e.g. 2 for 2% — always the FULL commission rate, referral not yet applied. */
  commissionPercent: number;
  hasReferral: boolean;
  /** % of the commission (not of price) taken by the referral, e.g. 25. */
  referralPercent?: number;
  sikkumDate?: string;
  signingDate?: string;
  stage: DealStage;
  paymentStatus: PaymentStatus;
  /** Free text, agent-editable on their own deals. */
  notes?: string;
  /** Which required fields sikkumPigisha left blank — surfaced to the
   *  owning agent so they know what to fill in themselves (they can only
   *  complete missing fields, never edit already-provided figures). */
  incompleteFields?: string[];
  /** Resolved Green Invoice client GUID, once matched/created — avoids
   *  re-searching Green Invoice's client list on every document created
   *  against this deal. */
  greenInvoiceClientId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Billing {
  id: string;
  officeId: string;
  dealId: string;
  /** Gross amount owed by the client — VAT-inclusive, referral NOT
   *  subtracted (the referral cut is an internal office/agent split
   *  concern, not something the client's bill reflects). */
  amount: number;
  issuedDate: string;
  greenInvoiceRef?: string;
  createdAt: string;
}

export interface Income {
  id: string;
  officeId: string;
  dealId: string;
  /** Actual amount received this installment — a deal can span several. */
  amount: number;
  receivedDate: string;
  greenInvoiceReceiptRef?: string;
  createdAt: string;
}

export type AgentLedgerEntryType =
  | "commission"
  | "expense"
  | "payment_to_agent"
  | "payment_by_agent";

export interface AgentLedgerAttachment {
  /** e.g. "Tax invoice" (agent's חשבונית מס, authorizes payment) or
   *  "Kabbala" (proof the office has paid). */
  label: string;
  s3Key: string;
  uploadedAt: string;
}

export interface AgentLedgerEntry {
  id: string;
  officeId: string;
  agentId: string;
  agentName: string;
  type: AgentLedgerEntryType;
  /** VAT-inclusive signed amount — the cash figure. This is what the
   *  running balance sums and what the daily report's יתירה תזרימית shows.
   *  Positive = credit to the agent — commission owed (`commission`), or
   *  the agent settling their own expense tab (`payment_by_agent`).
   *  Negative = debit — an expense charged (`expense`), or a payment the
   *  office already made to the agent (`payment_to_agent`). */
  amount: number;
  /** Same sign as `amount`, VAT stripped (amount ÷ 1 + VAT_RATE). The
   *  agent's actual earnings/liability, and what commission-tier
   *  accumulation is measured in. */
  amountExVat: number;
  description: string;
  dealId?: string;
  /** payment_to_agent entries should carry exactly 2: tax invoice + Kabbala. */
  attachments?: AgentLedgerAttachment[];
  date: string;
  createdAt: string;
}

export interface RecurringExpenseConfig {
  id: string;
  officeId: string;
  agentId: string;
  agentName: string;
  label: string;
  amount: number;
  active: boolean;
}

export interface CommissionTierRule {
  /** Cumulative YTD income threshold this rate kicks in at. */
  thresholdIls: number;
  /** Agent's share once at/above this threshold, e.g. 0.5 for 50%. */
  agentRate: number;
}

export interface CommissionTierOverride {
  officeId: string;
  agentId: string;
  agentName: string;
  /** Overrides the tier table entirely — a permanent flat rate. */
  flatAgentRate: number;
}
