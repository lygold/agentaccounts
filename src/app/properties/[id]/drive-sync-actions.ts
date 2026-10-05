"use server";

import { requireSession } from "@/lib/auth/session-cookie";
import { allowedAgentIds, isIdAllowed } from "@/lib/auth/scope";
import { getProperty } from "@/lib/store/properties";
import { syncPropertyFromDrive, type SyncResult } from "@/lib/storage/drive-sync";

export type DriveSyncActionResult = ({ ok: true } & SyncResult) | { ok: false; error: string };

/** One batch of the lazy Drive -> storage backfill for a property the caller
 *  may see. The client calls this repeatedly until `remaining` is 0. */
export async function syncPropertyDrive(propertyId: string, force: boolean): Promise<DriveSyncActionResult> {
  try {
    const session = await requireSession();
    const property = await getProperty(propertyId);
    if (!property || property.officeId !== session.officeId) return { ok: false, error: "Not found" };
    const allowed = await allowedAgentIds(session);
    if (!isIdAllowed(allowed, property.agentId)) return { ok: false, error: "Not found" };

    const result = await syncPropertyFromDrive(propertyId, session.officeId, { force });
    return { ok: true, ...result };
  } catch (e) {
    console.error("syncPropertyDrive failed:", e);
    return { ok: false, error: e instanceof Error ? e.message : "Sync failed" };
  }
}
