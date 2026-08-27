"use server";

import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session-cookie";
import { LedgerEntrySchema } from "@/lib/form-parse";
import { createLedgerEntry } from "@/lib/store/agent-ledger";
import { isNextJsRedirect } from "@/lib/action-utils";

export async function submitLedgerEntry(
  agentId: string,
  agentName: string,
  formData: FormData,
) {
  try {
    const session = await requireSession();
    const parsed = LedgerEntrySchema.safeParse({
      type: formData.get("type"),
      amount: formData.get("amount"),
      description: formData.get("description"),
      date: formData.get("date"),
    });
    if (!parsed.success) return;

    // Expenses and payments reduce the agent's balance — the form takes a
    // positive number either way and this normalizes the sign so agents
    // never have to remember to type a minus.
    const signedAmount =
      parsed.data.type === "commission" ? parsed.data.amount : -Math.abs(parsed.data.amount);

    await createLedgerEntry({
      officeId: session.officeId,
      agentId,
      agentName,
      type: parsed.data.type,
      amount: signedAmount,
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
