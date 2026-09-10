"use server";

import { redirect } from "next/navigation";
import { requireManager } from "@/lib/auth/session-cookie";
import { getAgentById } from "@/lib/store/agents";
import { DealSchema, IncomeEntrySchema } from "@/lib/form-parse";
import {
  createDealTransactionAccount,
  createDealWithBilling,
  resolveGiClientForDeal,
  sendTransactionAccount,
  setGiClientForDeal,
} from "@/lib/services/deals";
import { recordDealPayment } from "@/lib/services/payments";
import { isNextJsRedirect } from "@/lib/action-utils";

export async function submitNewDeal(formData: FormData) {
  try {
    const session = await requireManager();
    const parsed = DealSchema.safeParse({
      agentId: formData.get("agentId"),
      dealType: formData.get("dealType"),
      side: formData.get("side"),
      clientName: formData.get("clientName"),
      propertyAddress: formData.get("propertyAddress") || undefined,
      salePrice: formData.get("salePrice"),
      commissionPercent: formData.get("commissionPercent"),
      hasReferral: formData.get("hasReferral") === "on",
      referralPercent: formData.get("referralPercent") || undefined,
      sikkumDate: formData.get("sikkumDate") || undefined,
      signingDate: formData.get("signingDate") || undefined,
    });
    if (!parsed.success) return;

    const agent = await getAgentById(parsed.data.agentId);
    if (!agent || agent.officeId !== session.officeId || agent.status !== "active") {
      redirect("/deals/new?error=agent");
    }
    const deal = await createDealWithBilling({
      officeId: session.officeId,
      agentId: agent.id,
      agentName: agent.name,
      team: agent.team,
      dealType: parsed.data.dealType,
      side: parsed.data.side,
      clientName: parsed.data.clientName,
      propertyAddress: parsed.data.propertyAddress,
      salePrice: parsed.data.salePrice,
      commissionPercent: parsed.data.commissionPercent,
      hasReferral: parsed.data.hasReferral,
      referralPercent: parsed.data.referralPercent,
      sikkumDate: parsed.data.sikkumDate,
      signingDate: parsed.data.signingDate,
    });

    redirect(`/deals/${deal.id}`);
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("submitNewDeal failed:", e);
    redirect("/deals?error=save");
  }
}

/**
 * Log a client payment against a deal — auto-posts the agent's commission
 * (see services/payments.ts). No manual rate.
 */
export async function submitIncome(dealId: string, formData: FormData) {
  try {
    const session = await requireManager();
    const parsed = IncomeEntrySchema.safeParse({
      amount: formData.get("amount"),
      receivedDate: formData.get("receivedDate"),
    });
    if (!parsed.success) return;

    await recordDealPayment({
      officeId: session.officeId,
      dealId,
      amount: parsed.data.amount,
      receivedDate: parsed.data.receivedDate,
    });

    redirect(`/deals/${dealId}`);
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("submitIncome failed:", e);
    redirect(`/deals/${dealId}?error=save`);
  }
}

/**
 * Search Green Invoice for a client matching this deal's clientName. 0/1
 * matches resolve immediately; 2+ redirects back with the candidates in the
 * query string so the page can render a pick-or-create form.
 */
export async function searchGreenInvoiceClientForDeal(dealId: string) {
  try {
    const session = await requireManager();
    const resolution = await resolveGiClientForDeal(dealId, session.officeId);
    if (!resolution || resolution.status === "resolved") {
      redirect(`/deals/${dealId}`);
    } else {
      const encoded = encodeURIComponent(JSON.stringify(resolution.candidates));
      redirect(`/deals/${dealId}?giCandidates=${encoded}`);
    }
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("searchGreenInvoiceClientForDeal failed:", e);
    redirect(`/deals/${dealId}?error=save`);
  }
}

/** Finalizes an ambiguous client match — either an existing candidate's id, or "new". */
export async function confirmGreenInvoiceClient(dealId: string, formData: FormData) {
  try {
    const session = await requireManager();
    const choice = formData.get("clientChoice");
    if (typeof choice === "string") {
      await setGiClientForDeal(dealId, choice, session.officeId);
    }
    redirect(`/deals/${dealId}`);
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("confirmGreenInvoiceClient failed:", e);
    redirect(`/deals/${dealId}?error=save`);
  }
}

function sendTargets(formData: FormData) {
  return {
    toAgent: formData.get("toAgent") === "on",
    toClient: formData.get("toClient") === "on",
  };
}

/** Creates the חשבון עסקה (300) for this deal's billing, optionally emailing
 *  it to the agent and/or the client (the form's checkboxes). */
export async function createTransactionAccountForDeal(
  dealId: string,
  formData: FormData,
) {
  try {
    const session = await requireManager();
    await createDealTransactionAccount(dealId, session.officeId, sendTargets(formData));
    redirect(`/deals/${dealId}`);
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("createTransactionAccountForDeal failed:", e);
    redirect(`/deals/${dealId}?error=save`);
  }
}

/** Re-send an existing 300 to the agent and/or client — repeatable. */
export async function sendTransactionAccountForDeal(
  dealId: string,
  formData: FormData,
) {
  try {
    const session = await requireManager();
    await sendTransactionAccount(dealId, session.officeId, sendTargets(formData));
    redirect(`/deals/${dealId}`);
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("sendTransactionAccountForDeal failed:", e);
    redirect(`/deals/${dealId}?error=save`);
  }
}

// createReceiptForIncome removed in Phase 6 — the app doesn't issue receipts.
// Levi/Ariyel create the 305/320/400 in Green Invoice; the GI webhook
// (/api/green-invoice/webhook) turns those into income + commission.
