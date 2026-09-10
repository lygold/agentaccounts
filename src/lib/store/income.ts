import "server-only";
import { getById, insert, newId, queryByIndex, update } from "./dynamo-store";
import { TABLES } from "./dynamo-client";
import type { Income } from "../types";

export async function listIncomeForDeal(dealId: string): Promise<Income[]> {
  return queryByIndex<Income>(TABLES.income(), "byDealId", "dealId", dealId);
}

export async function getIncome(id: string): Promise<Income | null> {
  return getById<Income>(TABLES.income(), id);
}

export async function totalReceivedForDeal(dealId: string): Promise<number> {
  const rows = await listIncomeForDeal(dealId);
  return rows.reduce((sum, r) => sum + r.amount, 0);
}

export async function createIncome(
  input: Omit<Income, "id" | "createdAt">,
): Promise<Income> {
  const income: Income = { ...input, id: newId(), createdAt: new Date().toISOString() };
  return insert(TABLES.income(), income);
}

export async function updateIncome(
  id: string,
  patch: Partial<Omit<Income, "id" | "createdAt">>,
  expectedOfficeId?: string,
): Promise<Income | null> {
  return update<Income>(TABLES.income(), id, patch, expectedOfficeId);
}
