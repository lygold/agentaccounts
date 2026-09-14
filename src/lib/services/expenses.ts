import "server-only";
import { addVat, stripVat } from "../commission";
import { currentMonth, isChargeableInMonth } from "../expense-schedule";
import { DEFAULT_OFFICE_ID } from "../office";
import { STANDARD_EXPENSES } from "../office-defaults";
import { getAgentById, listAgentsByOffice, updateAgent } from "../store/agents";
import {
  createLedgerEntry,
  createLedgerEntryIfAbsent,
  listLedgerEntriesForAgent,
  markLedgerEntriesBilled,
} from "../store/agent-ledger";
import { putGiDocument } from "../store/gi-documents";
import {
  createRecurringExpense,
  listRecurringExpensesForAgent,
  listRecurringExpensesForOffice,
} from "../store/recurring-expenses";
import { resolveGreenInvoiceClient } from "../green-invoice/clients";
import {
  createAgentExpenseAccount,
  type GreenInvoiceDocument,
} from "../green-invoice/documents";
import type { AgentLedgerEntry, AgentRecord, RecurringExpense } from "../types";

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

// --- variable expenses: bulk import commit --------------------------------

export interface ImportRow {
  agentId: string;
  agentName: string;
  date: string;
  qty: number;
  unitCost: number;
}

/**
 * Turn a reviewed bulk-import batch into `expense` entries. Idempotent per
 * (vendor, agent, date, qty, unitCost) so re-importing the same file is a
 * no-op. Line amount = qty × unitCost, pre-VAT.
 */
export async function commitExpenseImport(
  officeId: string,
  vendor: string,
  rows: ImportRow[],
): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;
  for (const r of rows) {
    const amountExVat = Math.round(r.qty * r.unitCost * 100) / 100;
    if (!r.agentId || amountExVat <= 0) {
      skipped++;
      continue;
    }
    const id = `imp-${vendor}-${r.agentId}-${r.date}-${r.qty}x${r.unitCost}`
      .replace(/[^\w.-]/g, "_")
      .slice(0, 200);
    const entry = await createLedgerEntryIfAbsent(id, {
      officeId,
      agentId: r.agentId,
      agentName: r.agentName,
      type: "expense",
      amount: -addVat(amountExVat),
      amountExVat: -amountExVat,
      description: `${vendor} — ${r.qty} × ₪${r.unitCost} (${r.date})`,
      date: r.date,
    });
    if (entry) created++;
    else skipped++;
  }
  return { created, skipped };
}

// --- billing an agent for their own expenses --------------------------------

/**
 * Bundle an agent's unbilled `expense` entries into one חשבון עסקה (300),
 * addressed to a GI client representing the agent (resolved by name once,
 * then cached on `agent.greenInvoiceClientId`). Levi charges the card and
 * issues the receipt in GI; the webhook's agent-expenses branch
 * (`recordAgentExpensePayment`) closes the loop. Returns null when there's
 * nothing unbilled, the agent doesn't exist, or the GI client name is
 * ambiguous (needs a manual pick — not built; retry after Levi resolves it
 * in GI directly).
 */
export async function billAgentExpenses(
  agentId: string,
  officeId: string,
): Promise<GreenInvoiceDocument | null> {
  const agent = await getAgentById(agentId);
  if (!agent || agent.officeId !== officeId) return null;

  const unbilled = (await listLedgerEntriesForAgent(agentId)).filter(
    (e) => e.type === "expense" && !e.billedGiDocId,
  );
  if (unbilled.length === 0) return null;

  let clientId = agent.greenInvoiceClientId;
  if (!clientId) {
    const resolution = await resolveGreenInvoiceClient(agent.name);
    if (resolution.status !== "resolved") return null;
    clientId = resolution.clientId;
    await updateAgent(agentId, { greenInvoiceClientId: clientId });
  }

  const doc = await createAgentExpenseAccount({
    clientId,
    lines: unbilled.map((e) => ({
      description: e.description,
      amountExVat: Math.abs(e.amountExVat),
    })),
  });

  const totalIncl = unbilled.reduce((sum, e) => sum + Math.abs(e.amount), 0);
  await putGiDocument({
    id: doc.id,
    officeId,
    giType: 300,
    giNumber: Number(doc.number),
    giClientId: clientId,
    amount: totalIncl,
    linkedGiId: null,
    targetKind: "agent-expenses",
    agentId,
    expenseEntryIds: unbilled.map((e) => e.id),
    origin: "app",
  });
  await markLedgerEntriesBilled(
    unbilled.map((e) => e.id),
    doc.id,
  );
  return doc;
}

/**
 * The agent-expenses side of the GI webhook (`green-invoice/webhook-handler.ts`):
 * a 320/400 against an agent-expenses 300 means the agent paid their bill.
 * One `payment_by_agent` credit for the total — it settles the `expense`
 * entries already on the ledger; there's nothing further to mark on them.
 */
export async function recordAgentExpensePayment(input: {
  officeId: string;
  agentId: string;
  amount: number;
  date: string;
  giDocId: string;
}): Promise<AgentLedgerEntry> {
  const agent = await getAgentById(input.agentId);
  return createLedgerEntry({
    officeId: input.officeId,
    agentId: input.agentId,
    agentName: agent?.name ?? "",
    type: "payment_by_agent",
    amount: input.amount,
    amountExVat: stripVat(input.amount),
    description: `Agent settled expenses — GI doc ${input.giDocId.slice(0, 8)}`,
    date: input.date,
  });
}
