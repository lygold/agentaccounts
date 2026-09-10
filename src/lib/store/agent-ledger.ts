import "server-only";
import { insert, newId, queryByIndex } from "./dynamo-store";
import { TABLES } from "./dynamo-client";
import { stripVat } from "../commission";
import type { AgentLedgerEntry } from "../types";

export async function listLedgerEntriesForAgent(agentId: string): Promise<AgentLedgerEntry[]> {
  const entries = await queryByIndex<AgentLedgerEntry>(
    TABLES.agentAccount(),
    "byAgentId",
    "agentId",
    agentId,
  );
  return entries.sort((a, b) => b.date.localeCompare(a.date));
}

/** Every ledger entry in an office, newest first. Office-scoped query
 *  (byOfficeId GSI) — never a full-table scan. */
export async function listLedgerEntriesForOffice(
  officeId: string,
): Promise<AgentLedgerEntry[]> {
  const all = await queryByIndex<AgentLedgerEntry>(
    TABLES.agentAccount(),
    "byOfficeId",
    "officeId",
    officeId,
  );
  return all.sort((a, b) => b.date.localeCompare(a.date));
}

/** Sum of a set of ledger entries already in hand — the agent page fetches
 *  the entries once and derives the balance from them rather than issuing a
 *  second identical GSI query. `basis` picks the VAT-inclusive cash figure
 *  (default, matches the daily report) or the pre-VAT figure. */
export function runningBalance(
  entries: AgentLedgerEntry[],
  basis: "incVat" | "exVat" = "incVat",
): number {
  return entries.reduce(
    (sum, e) => sum + (basis === "exVat" ? entryExVat(e) : e.amount),
    0,
  );
}

/** `amountExVat`, tolerating rows written before the field existed. */
export function entryExVat(e: AgentLedgerEntry): number {
  return e.amountExVat ?? stripVat(e.amount);
}

/** Every distinct agent seen in an office's ledger entries, with their
 *  running balance — powers the manager dashboard. Office-scoped. */
export async function listAgentBalances(officeId: string): Promise<
  Array<{ agentId: string; agentName: string; balance: number }>
> {
  const entries = await listLedgerEntriesForOffice(officeId);
  const byAgent = new Map<string, { agentName: string; balance: number }>();
  for (const e of entries) {
    const existing = byAgent.get(e.agentId) ?? { agentName: e.agentName, balance: 0 };
    existing.balance += e.amount;
    byAgent.set(e.agentId, existing);
  }
  return Array.from(byAgent.entries())
    .map(([agentId, v]) => ({ agentId, ...v }))
    .sort((a, b) => a.agentName.localeCompare(b.agentName));
}

export async function createLedgerEntry(
  input: Omit<AgentLedgerEntry, "id" | "createdAt" | "amountExVat"> & {
    amountExVat?: number;
  },
): Promise<AgentLedgerEntry> {
  const entry: AgentLedgerEntry = {
    ...input,
    // Derive the pre-VAT figure when the caller doesn't supply one (manual
    // entries); commission auto-posting passes both explicitly.
    amountExVat: input.amountExVat ?? stripVat(input.amount),
    id: newId(),
    createdAt: new Date().toISOString(),
  };
  return insert(TABLES.agentAccount(), entry);
}
