"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session-cookie";
import { getProperty, listPropertiesByOffice } from "@/lib/store/properties";
import { mirrorPropertyToMonday } from "@/lib/sync/properties";

/** Admin-only: re-push one property to Monday (create it, or update it). */
export async function retryMondaySyncAction(formData: FormData) {
  const session = await requireAdmin();
  const id = String(formData.get("propertyId") ?? "");
  const property = id ? await getProperty(id) : null;
  if (property && property.officeId === session.officeId) {
    await mirrorPropertyToMonday(property);
  }
  redirect("/admin/monday-sync");
}

/** Admin-only: re-push every property that failed or never reached Monday. */
export async function retryAllMondaySyncAction() {
  const session = await requireAdmin();
  const pending = (await listPropertiesByOffice(session.officeId)).filter(
    (p) => !p.mondayItemId || p.mondaySyncError,
  );
  for (const p of pending) await mirrorPropertyToMonday(p);
  redirect("/admin/monday-sync");
}
