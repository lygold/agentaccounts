import "server-only";
import { getById, insert, newId, queryByIndex, update } from "./dynamo-store";
import { TABLES } from "./dynamo-client";
import type { Deal } from "../types";

/** Every deal in an office, newest first. Office-scoped query (byOfficeId GSI)
 *  — never a full-table scan. */
export async function listDeals(officeId: string): Promise<Deal[]> {
  const deals = await queryByIndex<Deal>(TABLES.deals(), "byOfficeId", "officeId", officeId);
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
