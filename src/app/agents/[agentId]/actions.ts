"use server";

import { redirect } from "next/navigation";
import { requireManager } from "@/lib/auth/session-cookie";
import { LedgerEntrySchema } from "@/lib/form-parse";
import { addManualLedgerEntry } from "@/lib/services/ledger";
import { getAgentById } from "@/lib/store/agents";
import { isNextJsRedirect } from "@/lib/action-utils";

export async function submitLedgerEntry(agentId: string, formData: FormData) {
  try {
    const session = await requireManager();
    const parsed = LedgerEntrySchema.safeParse({
      type: formData.get("type"),
      amount: formData.get("amount"),
      description: formData.get("description"),
      date: formData.get("date"),
    });
    if (!parsed.success) return;

    // The agentId is a bound arg from the page — verify it's a real agent in
    // this office before posting an entry against it.
    const agent = await getAgentById(agentId);
    if (!agent || agent.officeId !== session.officeId) {
      redirect(`/agents/${encodeURIComponent(agentId)}?error=save`);
    }

    await addManualLedgerEntry({
      officeId: session.officeId,
      agentId,
      agentName: agent.name,
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
