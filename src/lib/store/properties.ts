import "server-only";
import { getById, insert, newId, queryByIndex, update } from "./dynamo-store";
import { TABLES } from "./dynamo-client";
import type { PropertyRecord } from "../types";

export async function getProperty(id: string): Promise<PropertyRecord | null> {
  return getById<PropertyRecord>(TABLES.properties(), id);
}

/** All listings for an office, newest first — same hash-only byOfficeId
 *  query pattern as listIncomeForOffice/listDeals. */
export async function listPropertiesByOffice(officeId: string): Promise<PropertyRecord[]> {
  const all = await queryByIndex<PropertyRecord>(
    TABLES.properties(),
    "byOfficeId",
    "officeId",
    officeId,
  );
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createProperty(
  input: Omit<PropertyRecord, "id" | "createdAt" | "updatedAt">,
): Promise<PropertyRecord> {
  const now = new Date().toISOString();
  const property: PropertyRecord = { ...input, id: newId(), createdAt: now, updatedAt: now };
  return insert(TABLES.properties(), property);
}

export async function updateProperty(
  id: string,
  patch: Partial<Omit<PropertyRecord, "id" | "createdAt">>,
  expectedOfficeId?: string,
): Promise<PropertyRecord | null> {
  return update<PropertyRecord>(
    TABLES.properties(),
    id,
    { ...patch, updatedAt: new Date().toISOString() },
    expectedOfficeId,
  );
}
