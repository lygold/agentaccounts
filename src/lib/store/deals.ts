import "server-only";
import { getById, insert, listAll, newId, queryByIndex, update } from "./dynamo-store";
import { TABLES } from "./dynamo-client";
import type { Deal } from "../types";

export async function listDeals(): Promise<Deal[]> {
  const deals = await listAll<Deal>(TABLES.deals());
  return deals.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getDeal(id: string): Promise<Deal | null> {
  return getById<Deal>(TABLES.deals(), id);
}

export async function createDeal(
  input: Omit<Deal, "id" | "createdAt" | "updatedAt">,
): Promise<Deal> {
  const now = new Date().toISOString();
  const deal: Deal = { ...input, id: newId(), createdAt: now, updatedAt: now };
  return insert(TABLES.deals(), deal);
}

export async function updateDeal(
  id: string,
  patch: Partial<Omit<Deal, "id" | "createdAt">>,
  expectedOfficeId?: string,
): Promise<Deal | null> {
  return update<Deal>(
    TABLES.deals(),
    id,
    { ...patch, updatedAt: new Date().toISOString() },
    expectedOfficeId,
  );
}

export async function listDealsByAgent(agentId: string): Promise<Deal[]> {
  const deals = await queryByIndex<Deal>(TABLES.deals(), "byAgentId", "agentId", agentId);
  return deals.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
