import "server-only";
import { insert, listAll, newId, queryByIndex } from "./dynamo-store";
import { TABLES } from "./dynamo-client";
import type { AgentLedgerEntry } from "../types";

export async function listLedgerEntriesForAgent(agentId: string): Promise<AgentLedgerEntry[]> {
  const entries = await queryByIndex<AgentLedgerEntry>(
    TABLES.ledgerEntries(),
    "byAgentId",
    "agentId",
    agentId,
  );
  return entries.sort((a, b) => b.date.localeCompare(a.date));
}

export async function listAllLedgerEntries(): Promise<AgentLedgerEntry[]> {
  const all = await listAll<AgentLedgerEntry>(TABLES.ledgerEntries());
  return all.sort((a, b) => b.date.localeCompare(a.date));
}

export async function agentRunningBalance(agentId: string): Promise<number> {
  const entries = await listLedgerEntriesForAgent(agentId);
  return entries.reduce((sum, e) => sum + e.amount, 0);
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
  input: Omit<AgentLedgerEntry, "id" | "createdAt">,
): Promise<AgentLedgerEntry> {
  const entry: AgentLedgerEntry = {
    ...input,
    id: newId(),
    createdAt: new Date().toISOString(),
  };
  return insert(TABLES.ledgerEntries(), entry);
}
