import "server-only";
import { addVat } from "../commission";
import { currentMonth, isChargeableInMonth } from "../expense-schedule";
import { DEFAULT_OFFICE_ID } from "../office";
import { STANDARD_EXPENSES } from "../office-defaults";
import { listAgentsByOffice } from "../store/agents";
import { createLedgerEntryIfAbsent } from "../store/agent-ledger";
import {
  createRecurringExpense,
  listRecurringExpensesForAgent,
  listRecurringExpensesForOffice,
} from "../store/recurring-expenses";
import type { AgentRecord, RecurringExpense } from "../types";

/**
 * Agent monthly expenses (Phase 6). The FIXED charges (office fee, מדלן, פרמי)
 * live in `recurring-expenses`; `runMonthlyExpenses` writes one `expense`
 * entry per active row per eligible agent per month. VARIABLE charges (Yad2,
 * Torah Tidbits) come from the monthly bulk import instead.
 */

export const OFFICE_FEE_LABEL = "דמי משרד";
const OFFICE_FEE_ID = (agentId: string) => `rex-${agentId}-officefee`;

/** Seed the office-fee recurring row for a new agent. Idempotent by id. */
export async function seedOfficeFee(agent: AgentRecord): Promise<void> {
  const id = OFFICE_FEE_ID(agent.id);
  const already = (await listRecurringExpensesForAgent(agent.id)).some((r) => r.id === id);
  if (already) return;
  await createRecurringExpense({
    id,
    officeId: agent.officeId,
    agentId: agent.id,
    label: OFFICE_FEE_LABEL,
    catalogNum: "דמי משרד",
    amountExVat: agent.officeFeeExVat ?? STANDARD_EXPENSES.officeFee,
    active: true,
  });
}

export interface MonthlyRunResult {
  month: string;
  agentsCharged: number;
  entriesCreated: number;
  skippedExisting: number;
  notYetCharging: number;
}

/**
 * Write the month's fixed recurring charges into `agent-account`. Idempotent
 * (deterministic entry id `rex-<recurringId>-<yyyy-mm>`), so the cron can run
 * daily around the billing date without ever double-charging.
 */
export async function runMonthlyExpenses(
  officeId: string = DEFAULT_OFFICE_ID,
  month: string = currentMonth(),
): Promise<MonthlyRunResult> {
  const [roster, allRows] = await Promise.all([
    listAgentsByOffice(officeId, { includeArchived: true }),
    listRecurringExpensesForOffice(officeId),
  ]);
  // Charge active AND onboarding agents (an onboarding agent past their
  // charge date is already paying); never archived.
  const agents = roster.filter((a) => a.status !== "archived");
  const byAgent = new Map<string, RecurringExpense[]>();
  for (const r of allRows) {
    const list = byAgent.get(r.agentId) ?? [];
    list.push(r);
    byAgent.set(r.agentId, list);
  }

  const res: MonthlyRunResult = {
    month,
    agentsCharged: 0,
    entriesCreated: 0,
    skippedExisting: 0,
    notYetCharging: 0,
  };

  for (const agent of agents) {
    if (!isChargeableInMonth(agent.expenseChargeDate, month)) {
      res.notYetCharging++;
      continue;
    }
    const rows = (byAgent.get(agent.id) ?? []).filter(
      (r) => r.active && (!r.startMonth || month >= r.startMonth),
    );
    let chargedThisAgent = false;
    for (const r of rows) {
      const entry = await createLedgerEntryIfAbsent(`rex-${r.id}-${month}`, {
        officeId,
        agentId: agent.id,
        agentName: agent.name,
        type: "expense",
        amount: -addVat(r.amountExVat),
        amountExVat: -r.amountExVat,
        description: `${r.label} — ${month}`,
        date: `${month}-01`,
      });
      if (entry) {
        res.entriesCreated++;
        chargedThisAgent = true;
      } else {
        res.skippedExisting++;
      }
    }
    if (chargedThisAgent) res.agentsCharged++;
  }
  return res;
}
