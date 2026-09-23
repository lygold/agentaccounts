import "server-only";
import { getById, insert, newId, queryByIndex } from "./dynamo-store";
import { TABLES } from "./dynamo-client";
import type { ReferralRecord } from "../types";

/**
 * `dealId` is a GSI key (byDealId) — DynamoDB requires a GSI key attribute
 * to be either present with a matching type or entirely ABSENT from the
 * item; an explicit `null` value throws ("Type mismatch ... Expected: S
 * Actual: NULL"). Same constraint src/lib/store/agents.ts already works
 * around for email/phone. toItem/fromItem keep this DynamoDB-specific
 * detail local to this file — everything else still sees a plain
 * `dealId: string | null`, same as ReferralRecord declares.
 */
type ReferralItem = Omit<ReferralRecord, "dealId"> & { dealId?: string };

function toItem(r: ReferralRecord): ReferralItem {
  const { dealId, ...rest } = r;
  return { ...rest, ...(dealId ? { dealId } : {}) };
}

function fromItem(item: Record<string, unknown>): ReferralRecord {
  return {
    ...(item as unknown as ReferralRecord),
    dealId: (item.dealId as string | undefined) ?? null,
  };
}

export async function getReferral(id: string): Promise<ReferralRecord | null> {
  const item = await getById<Record<string, unknown>>(TABLES.referrals(), id);
  return item ? fromItem(item) : null;
}

/** All referrals for an office, newest first — same hash-only byOfficeId
 *  query pattern as listPropertiesByOffice. */
export async function listReferralsByOffice(officeId: string): Promise<ReferralRecord[]> {
  const all = await queryByIndex<Record<string, unknown>>(
    TABLES.referrals(),
    "byOfficeId",
    "officeId",
    officeId,
  );
  return all.map(fromItem).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createReferral(
  input: Omit<ReferralRecord, "id" | "createdAt" | "updatedAt">,
): Promise<ReferralRecord> {
  const now = new Date().toISOString();
  const referral: ReferralRecord = { ...input, id: newId(), createdAt: now, updatedAt: now };
  await insert(TABLES.referrals(), toItem(referral));
  return referral;
}

/** Merge-then-put, same shape as dynamo-store.update — hand-rolled (like
 *  agents.ts's updateAgent) rather than calling that generic helper
 *  directly, since the final write needs to go through toItem too. */
export async function updateReferral(
  id: string,
  patch: Partial<Omit<ReferralRecord, "id" | "createdAt">>,
  expectedOfficeId?: string,
): Promise<ReferralRecord | null> {
  const existing = await getReferral(id);
  if (!existing) return null;
  if (expectedOfficeId !== undefined && existing.officeId !== expectedOfficeId) return null;
  const merged: ReferralRecord = { ...existing, ...patch, updatedAt: new Date().toISOString() };
  await insert(TABLES.referrals(), toItem(merged));
  return merged;
}
