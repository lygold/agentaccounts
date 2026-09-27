import "server-only";
import { randomUUID } from "crypto";
import { getById, insert, queryByIndex, update } from "./dynamo-store";
import { TABLES } from "./dynamo-client";
import type { OfferRecord } from "../types";

export async function getOffer(id: string): Promise<OfferRecord | null> {
  return getById<OfferRecord>(TABLES.offers(), id);
}

/** The public buyer-facing page's only lookup path — token is unique per
 *  offer, so at most one result. */
export async function getOfferByToken(token: string): Promise<OfferRecord | null> {
  const rows = await queryByIndex<OfferRecord>(TABLES.offers(), "byToken", "token", token);
  return rows[0] ?? null;
}

/** All offers for an office, newest first — same byOfficeId query pattern
 *  as listPropertiesByOffice. */
export async function listOffersByOffice(officeId: string): Promise<OfferRecord[]> {
  const all = await queryByIndex<OfferRecord>(TABLES.offers(), "byOfficeId", "officeId", officeId);
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createOffer(
  input: Omit<OfferRecord, "id" | "createdAt" | "updatedAt">,
): Promise<OfferRecord> {
  const now = new Date().toISOString();
  const offer: OfferRecord = { ...input, id: `ofr_${randomUUID()}`, createdAt: now, updatedAt: now };
  return insert(TABLES.offers(), offer);
}

export async function updateOffer(
  id: string,
  patch: Partial<Omit<OfferRecord, "id" | "createdAt">>,
  expectedOfficeId?: string,
): Promise<OfferRecord | null> {
  return update<OfferRecord>(
    TABLES.offers(),
    id,
    { ...patch, updatedAt: new Date().toISOString() },
    expectedOfficeId,
  );
}
