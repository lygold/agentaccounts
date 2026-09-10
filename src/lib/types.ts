/**
 * Core data model — see ROADMAP.md for the full rationale.
 *
 * agentId on Deal/AgentLedgerEntry is this app's own `agents` table id
 * (`agt_…`) as of Phase 4. Rows imported from Daf Kesher (Monday) before
 * Phase 4 carried the Monday pulse id and were migrated
 * (scripts/migrate-deal-agent-ids.mjs).
 */

import type { AppRole } from "./monday/types";

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
  /** The `agents` table id (`agt_…`). Set from the agent picker as of
   *  Phase 4c; pre-4c rows were migrated from a Monday pulse id / typed name. */
  agentId: string;
  agentName: string;
  /** The agent's team when the deal was created — denormalised so
   *  team-leader scoping needs no roster lookup. */
  team?: number | null;
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
  /** How the row was created. `webhook` = a GI receipt (320/400) landed and
   *  the handler posted it; `manual` = keyed on the deal page; `app` = a
   *  future app-issued receipt. Absent on pre-Phase-6 rows. */
  source?: "app" | "webhook" | "manual";
  /** The `gi-documents` id (= the GI document id) this payment came from,
   *  when `source: "webhook"`. */
  giDocId?: string;
  /** GI's payment-method string ("wire-transfer", "cheque", …) for a
   *  webhook-sourced row. */
  paymentMethod?: string;
  createdAt: string;
}

/** Green Invoice document types the app tracks — see
 *  `src/lib/green-invoice/documents.ts` DOCUMENT_TYPE. */
export type GiDocType = 300 | 305 | 320 | 400;

/**
 * One Green Invoice document the app knows about, keyed by the GI document id.
 * The app writes the 300 (with its target) when its "create חשבון עסקה" button
 * fires; the webhook writes 305/320/400 rows as it processes them, copying the
 * target down from the resolved 300. Physical table:
 * agent-ledger-gi-documents (key `id`, GSIs byDealId / byGiClientId).
 */
export interface GiDocumentRecord {
  /** = the Green Invoice document GUID. */
  id: string;
  officeId: string;
  giType: GiDocType;
  giNumber: number;
  giClientId: string;
  /** Total, VAT-inclusive. */
  amount: number;
  /** Parent GI doc id: 305→300, 400→305, 320→300. Null for a 300. */
  linkedGiId: string | null;
  /** What the document (chain) bills. `deal` today; `agent-expenses` is
   *  wired in the Phase 6 agent-expense work. Flat fields (not a union) so
   *  the byDealId GSI can index `dealId`. */
  targetKind: "deal" | "agent-expenses";
  dealId?: string;
  agentId?: string;
  expenseEntryIds?: string[];
  /** Who created this row. */
  origin: "app" | "webhook";
  createdAt: string;
  updatedAt: string;
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

export type AgentStatus = "onboarding" | "active" | "archived";

/**
 * The office's own agent directory — the app's canonical identity store as
 * of Phase 4, replacing per-request reads of the Daf Kesher (Monday) board.
 * Physical table: agent-ledger-agents (key `id`, GSIs byOfficeId / byEmail /
 * byPhone).
 */
export interface AgentRecord {
  /** `agt_<uuid>` — generated here, never a Monday id (see `mondayItemId`). */
  id: string;
  officeId: string;
  name: string;
  email: string | null;
  phone: string | null;
  firstNameHebrew: string | null;
  fullNameEnglish: string | null;
  surname: string | null;
  /** Team number (was "רובע" / district on Daf Kesher) — the grouping key
   *  for team-leader scoping. Null is valid. */
  team: number | null;
  isTeamLeader: boolean;
  role: AppRole;
  /** `onboarding` — on the roster, being tracked, can log in, but excluded
   *  from deal-assignment pickers. `active` — full. `archived` — blocks login,
   *  hidden from pickers; ledger history stays readable. Hard delete only when
   *  nothing references them. */
  status: AgentStatus;
  /** Set when the agent moves onboarding → active. */
  activatedAt: string | null;
  /** Real-estate license number (מספר רישיון תיווך). */
  licenseNumber: string | null;
  /** When the agent starts paying monthly expenses — NOT the join date; can
   *  be months out. ISO date (yyyy-mm-dd). Sourced from a Daf Kesher column
   *  once Levi adds it; the monthly expense job rounds it UP to the next full
   *  month (no partial months). See docs/mem/office-expenses-model.md. */
  expenseChargeDate: string | null;
  /** Per-agent office-fee override, ex-VAT. Null = use the office standard
   *  (post-July joiners pay more). */
  officeFeeExVat: number | null;
  /** Which office commission scheme applies. Null = office default.
   *  Unused until Phase 5c defines the schemes on the office record. */
  commissionSchemeId: string | null;
  /** Daf Kesher pulse id this row was imported from, if any — null for
   *  agents created in-app. Kept for the migration bridge + reconciliation. */
  mondayItemId: string | null;
  createdAt: string;
  updatedAt: string;
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
