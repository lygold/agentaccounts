import "server-only";
import type { AgentLedgerEntry, AgentLedgerEntryType } from "../types";
import { createLedgerEntry } from "../store/agent-ledger";

/**
 * Agent-ledger operations. Manual adjustments only for now — commission is
 * posted automatically from payments (see services/payments.ts) and
 * expense / payment rows will come from the Green Invoice webhook (Phase 3).
 */

/** Types that credit the agent's balance (positive). */
const CREDIT_TYPES = new Set<AgentLedgerEntryType>(["commission", "payment_by_agent"]);

export interface ManualLedgerEntryInput {
  officeId: string;
  agentId: string;
  agentName: string;
  type: AgentLedgerEntryType;
  /** The positive figure entered on the form, VAT-inclusive. Signed here. */
  amount: number;
  description: string;
  date: string;
}

/**
 * Add a manually-entered ledger adjustment. The form always takes a
 * positive number; the sign is applied by type — credits (commission,
 * payment_by_agent) stay positive, debits (expense, payment_to_agent) go
 * negative. `commission` keeps its raw sign so a negative correction works.
 * `amountExVat` is derived by createLedgerEntry.
 */
export async function addManualLedgerEntry(
  input: ManualLedgerEntryInput,
): Promise<AgentLedgerEntry> {
  const signed =
    input.type === "commission"
      ? input.amount
      : CREDIT_TYPES.has(input.type)
        ? Math.abs(input.amount)
        : -Math.abs(input.amount);

  return createLedgerEntry({
    officeId: input.officeId,
    agentId: input.agentId,
    agentName: input.agentName,
    type: input.type,
    amount: signed,
    description: input.description,
    date: input.date,
  });
}
