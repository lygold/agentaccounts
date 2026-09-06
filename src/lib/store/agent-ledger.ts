import "server-only";
import { insert, listAll, newId, queryByIndex } from "./dynamo-store";
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

export async function listAllLedgerEntries(): Promise<AgentLedgerEntry[]> {
  const all = await listAll<AgentLedgerEntry>(TABLES.agentAccount());
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

/** Every distinct agent seen across ledger entries, with their running
 *  balance — stand-in for a real agent directory until Phase 3's
 *  role-scoped views read agents directly from Daf Kesher instead. */
export async function listAgentBalances(): Promise<
  Array<{ agentId: string; agentName: string; balance: number }>
> {
  const entries = await listAllLedgerEntries();
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
