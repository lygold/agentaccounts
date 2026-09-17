import "server-only";
import { getById, insert, newId, queryByIndex, update } from "./dynamo-store";
import { TABLES } from "./dynamo-client";
import type { ReferralRecord } from "../types";

export async function getReferral(id: string): Promise<ReferralRecord | null> {
  return getById<ReferralRecord>(TABLES.referrals(), id);
}

/** All referrals for an office, newest first — same hash-only byOfficeId
 *  query pattern as listPropertiesByOffice. */
export async function listReferralsByOffice(officeId: string): Promise<ReferralRecord[]> {
  const all = await queryByIndex<ReferralRecord>(
    TABLES.referrals(),
    "byOfficeId",
    "officeId",
    officeId,
  );
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createReferral(
  input: Omit<ReferralRecord, "id" | "createdAt" | "updatedAt">,
): Promise<ReferralRecord> {
  const now = new Date().toISOString();
  const referral: ReferralRecord = { ...input, id: newId(), createdAt: now, updatedAt: now };
  return insert(TABLES.referrals(), referral);
}

export async function updateReferral(
  id: string,
  patch: Partial<Omit<ReferralRecord, "id" | "createdAt">>,
  expectedOfficeId?: string,
): Promise<ReferralRecord | null> {
  return update<ReferralRecord>(
    TABLES.referrals(),
    id,
    { ...patch, updatedAt: new Date().toISOString() },
    expectedOfficeId,
  );
}
