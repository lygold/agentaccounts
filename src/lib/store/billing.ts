import "server-only";
import { insert, newId, queryByIndex, update } from "./dynamo-store";
import { TABLES } from "./dynamo-client";
import type { Billing } from "../types";

export async function listBillingForDeal(dealId: string): Promise<Billing[]> {
  return queryByIndex<Billing>(TABLES.billing(), "byDealId", "dealId", dealId);
}

export async function createBilling(
  input: Omit<Billing, "id" | "createdAt">,
): Promise<Billing> {
  const billing: Billing = { ...input, id: newId(), createdAt: new Date().toISOString() };
  return insert(TABLES.billing(), billing);
}

export async function updateBilling(
  id: string,
  patch: Partial<Omit<Billing, "id" | "createdAt">>,
  expectedOfficeId?: string,
): Promise<Billing | null> {
  return update<Billing>(TABLES.billing(), id, patch, expectedOfficeId);
}
