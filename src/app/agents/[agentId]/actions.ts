"use server";

import { redirect } from "next/navigation";
import { requireManager } from "@/lib/auth/session-cookie";
import { LedgerEntrySchema } from "@/lib/form-parse";
import { addManualLedgerEntry } from "@/lib/services/ledger";
import { isNextJsRedirect } from "@/lib/action-utils";

export async function submitLedgerEntry(
  agentId: string,
  agentName: string,
  formData: FormData,
) {
  try {
    const session = await requireManager();
    const parsed = LedgerEntrySchema.safeParse({
      type: formData.get("type"),
      amount: formData.get("amount"),
      description: formData.get("description"),
      date: formData.get("date"),
    });
    if (!parsed.success) return;

    await addManualLedgerEntry({
      officeId: session.officeId,
      agentId,
      agentName,
      type: parsed.data.type,
      amount: parsed.data.amount,
      description: parsed.data.description,
      date: parsed.data.date,
    });

    redirect(`/agents/${encodeURIComponent(agentId)}`);
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("submitLedgerEntry failed:", e);
    redirect(`/agents/${encodeURIComponent(agentId)}?error=save`);
  }
}
