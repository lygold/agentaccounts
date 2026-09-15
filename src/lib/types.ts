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

/** Doc-output language, from the wizard's language step — drives which
 *  Google Docs template the Make PDF scenario picks. */
export type DocLanguage = "hebrew" | "english";

/** Wizard-mirror status column mirrored to Monday's Deals_Raw_Data
 *  `pdfStatus` — the existing Make.com scenario watches that column to
 *  build + email the summary-of-terms PDF. Kept on Deal only for admin
 *  visibility; Monday's column is what Make actually reads. */
export type PdfStatus = "building_pdf" | "manual_steps_necessary";

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
  /** Absent while `stage: "potential"` — there is nothing to owe on a deal
   *  that hasn't been signed, so no Billing row exists yet either (see
   *  services/deals.ts markDealSigned, the only place that both creates
   *  Billing and sets this). Always set once `stage: "signed"`. */
  paymentStatus?: PaymentStatus;
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
  /** Set when this deal was created via the /sikkum wizard (Phase 8),
   *  absent for the older manager quick-form / migrated rows. */
  docLanguage?: DocLanguage;
  /** Only meaningful when the wizard's `representation` wasn't "both" — who
   *  represents the side this deal's agent doesn't. See wizard Draft. */
  otherSideRepresentedBy?: "colleague" | "external";
  pdfStatus?: PdfStatus;
  /** The Deals_Raw_Data item this deal is mirrored to during the Monday
   *  bridge (Phase 8-9) — lets mirrorDealToMonday() update in place on a
   *  resubmit instead of creating a duplicate item. */
  mondayItemId?: string;
  /** Properties/Offers board pulse ids the wizard prefilled from, when the
   *  agent picked an existing listing/offer rather than typing manually. */
  propertyId?: string;
  offerId?: string;
  /** RE/MAX franchise reporting — admin-only (see isAdmin), matching the
   *  Red File board's דיווח לרימקס / מספר של רימקס / דיווח חודשי columns. */
  remaxReportedDate?: string;
  remaxId?: string;
  remaxMonthlyReported?: boolean;
  /**
   * Agent payout lifecycle for this specific deal (per-deal, not per the
   * agent's whole balance — a deal only enters this once it's fully paid:
   * `paymentStatus === "paid"`). Matches ROADMAP's originally-scoped
   * `owed → invoice_requested → payable → paid → receipted` chain:
   *   - fully paid + no agentInvoiceAttachment yet → awaiting the agent's
   *     חשבונית מס (implicit state, nothing stored for it).
   *   - agentInvoiceAttachment set, no agentPaidAt → "payable" (Ariyel owes
   *     the agent the deal's posted commission total).
   *   - agentPaidAt set → paid; agentPayoutLedgerEntryId points at the
   *     payment_to_agent entry markDealAgentPaid() created.
   *   - agentReceiptAttachment set → "receipted" (agent's own קבלה, proof
   *     they received it — the office never produces this one).
   */
  agentInvoiceAttachment?: AgentLedgerAttachment;
  /** Advisory AI check run at upload time (see invoice-verify.ts) — never
   *  blocks the upload or a payment, just flags a mismatch for Ariyel to
   *  glance at before marking paid. */
  agentInvoiceVerification?: InvoiceVerification;
  agentPaidAt?: string;
  agentPayoutLedgerEntryId?: string;
  agentReceiptAttachment?: AgentLedgerAttachment;
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
  /** RE/MAX franchise reporting — admin-only, per-payment (Red File's
   *  subitem-level "תשלום דיווח לרימקס" checkbox — separate from the
   *  deal-level Deal.remaxMonthlyReported, since one deal can span several
   *  reporting cycles across its payments). */
  remaxMonthlyReported?: boolean;
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
  /** Each time the document was emailed from the app (the 300 to agent /
   *  client, repeatedly). */
  distributions?: Array<{ at: string; recipients: string[]; to: string[] }>;
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

/** Advisory AI check on an uploaded agent invoice — see invoice-verify.ts.
 *  Never blocks the upload or a payment, just flags a mismatch for Ariyel
 *  to glance at before marking paid. */
export interface InvoiceVerification {
  /** The invoice's own stated total, VAT-inclusive — null if Claude
   *  couldn't find one. */
  extractedAmount: number | null;
  /** Exact match against the deal's own posted commission (a few agorot of
   *  rounding slack) — null when extractedAmount is null (nothing to compare). */
  amountMatches: boolean | null;
  mentionsPropertyAddress: boolean;
  mentionsClientName: boolean;
  /** Whether the invoice text references the deal's side — מוכר/קונה/
   *  משכיר/שוכר, per Deal.side (see invoice-verify.ts's SIDE_LABELS_HE). */
  mentionsSide: boolean;
  /** Short Hebrew note from Claude when something looks off; absent when
   *  everything matches cleanly. */
  note?: string;
  /** Set when extraction itself failed (bad file, API error) — the upload
   *  still succeeds; this is just "we couldn't check it". */
  extractionFailed?: boolean;
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
  /** Set on an `expense` entry once it's bundled into an agent-expenses 300
   *  (`billAgentExpenses`) — excludes it from being bundled again while that
   *  bill is outstanding. The GI doc id. */
  billedGiDocId?: string;
  date: string;
  createdAt: string;
}

/**
 * A per-agent standing monthly charge (דמי משרד / מדלן / פרמי …). The monthly
 * cron (Phase 6, `services/expenses.ts`) reads the active rows and writes one
 * `expense` entry into `agent-account` per agent per month, respecting the
 * agent's `expenseChargeDate` schedule. Variable charges (Yad2, Torah
 * Tidbits) are NOT rows here — they come from the monthly bulk import.
 */
export interface RecurringExpense {
  id: string;
  officeId: string;
  agentId: string;
  /** Human label; matches a GI item מק"ט where one exists. */
  label: string;
  /** GI catalog מק"ט, when this maps to a catalog item (`green-invoice/gi-items`). */
  catalogNum: string | null;
  /** Pre-VAT monthly amount. */
  amountExVat: number;
  active: boolean;
  /** First month to charge, "yyyy-mm" — narrows the agent's own charge-date
   *  schedule when a line started later. Null = from the agent's first month. */
  startMonth: string | null;
  createdAt: string;
  updatedAt: string;
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
  /** Daf Kesher "Commission Tier": 50 (standard 50/55/60 brackets) or 60
   *  (flat 60). The bridge value until 5c turns it into a scheme. */
  commissionTier: number | null;
  /** Daf Kesher virtual phone numbers — match a Yad2 / Madlan ad-report row
   *  to the agent for the bulk expense import. */
  yad2Number: string | null;
  madlanNumber: string | null;
  /** The GI client billed for this agent's own expenses (`billAgentExpenses`),
   *  resolved + cached the first time they're billed. */
  greenInvoiceClientId: string | null;
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

// --- Phase 7: daily report / office finances --------------------------------

export type OfficeExpenseCategory =
  | "cc_fees"
  | "municipal"
  | "cleaning"
  | "pension"
  | "loan"
  | "ad_vendor"
  | "other";

/** A non-agent office cost (CC fees, עיריית ירושלים, cleaning, pension, loan,
 *  ad vendors) — the pieces of the daily report the ledger doesn't cover
 *  because every `AgentLedgerEntry` requires an `agentId`. Manual entry. */
export interface OfficeExpense {
  id: string;
  officeId: string;
  category: OfficeExpenseCategory;
  description: string;
  /** VAT-inclusive, positive. */
  amount: number;
  date: string; // yyyy-mm-dd
  createdAt: string;
}

/** One line from an imported bank statement (Bank Leumi "תנועות בחשבון" xlsx
 *  export — docs/mem/bank-export-format.md). Feeds report §2 + the cash-flow
 *  reconciliation. Not typed — imported. */
export interface BankTransaction {
  id: string;
  officeId: string;
  date: string; // ערך value date, yyyy-mm-dd
  description: string;
  credit: number; // זכות, 0 if none
  debit: number; // חובה, 0 if none
  reference: string; // אסמכתא
  typeCode: string; // סוג פעולה
  /** The statement's running balance after this line, when the export gave
   *  one for this row (blank on same-day intermediate rows). */
  balanceAfter: number | null;
  createdAt: string;
}

/** The settled end-of-day balance for one office/date. Id is
 *  `${officeId}:${date}` — re-importing a day overwrites, never duplicates. */
export interface BankBalance {
  id: string;
  officeId: string;
  date: string;
  balance: number;
  createdAt: string;
}

/** Manual entry (report §3): a deal where the client pays RE/MAX Israel
 *  directly, which issues the tax document and remits to the office. */
export interface RemaxIsraelReceipt {
  id: string;
  officeId: string;
  date: string;
  clientName: string;
  agentId: string;
  agentName: string;
  /** The gross RE/MAX Israel billed. */
  grossAmount: number;
  /** What the office actually received. */
  receivedAmount: number;
  /** RE/MAX Israel's own invoice number (~221xxx) — outside the office's GI. */
  invoiceNumber: string;
  notes?: string;
  createdAt: string;
}
