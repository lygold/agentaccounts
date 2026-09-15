"use server";

import { redirect } from "next/navigation";
import { requireManager, requireAdmin, requireSession, isAdmin } from "@/lib/auth/session-cookie";
import { IncomeEntrySchema } from "@/lib/form-parse";
import {
  createDealTransactionAccount,
  markDealSigned,
  markDealAgentPaid,
  resolveGiClientForDeal,
  sendTransactionAccount,
  setGiClientForDeal,
  uploadDealAgentInvoice,
  uploadDealAgentReceipt,
} from "@/lib/services/deals";
import { recordDealPayment } from "@/lib/services/payments";
import { getDeal, updateDeal } from "@/lib/store/deals";
import { listIncomeForDeal, updateIncome } from "@/lib/store/income";
import { isNextJsRedirect } from "@/lib/action-utils";

// submitNewDeal (the old manager-only quick form) was removed in Phase 8d —
// /deals/new is now the wizard's landing page for everyone, agents and
// managers alike. See src/lib/wizard/submit.ts for how a deal is created
// today.

/**
 * Move a deal from "potential" to "signed" — opens its Billing record for
 * the first time (see services/deals.ts markDealSigned). This is the fraud
 * gate the /sikkum wizard can't bypass on its own: an agent's submission
 * always lands as "potential"; only a manager marking it signed here moves
 * it forward.
 */
export async function markDealSignedAction(dealId: string, formData: FormData) {
  try {
    const session = await requireManager();
    const signingDate = formData.get("signingDate");
    await markDealSigned(
      dealId,
      session.officeId,
      typeof signingDate === "string" && signingDate ? signingDate : undefined,
    );
    redirect(`/deals/${dealId}`);
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("markDealSignedAction failed:", e);
    redirect(`/deals/${dealId}?error=save`);
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

/**
 * RE/MAX franchise reporting fields on the deal itself — admin-only
 * (matching Red File's דיווח לרימקס / מספר של רימקס / דיווח חודשי columns).
 */
export async function updateDealRemaxFieldsAction(dealId: string, formData: FormData) {
  try {
    const session = await requireAdmin();
    const deal = await getDeal(dealId);
    if (!deal || deal.officeId !== session.officeId) throw new Error("NOT_FOUND");
    const remaxReportedDate = (formData.get("remaxReportedDate") as string) || undefined;
    const remaxId = (formData.get("remaxId") as string)?.trim() || undefined;
    await updateDeal(
      dealId,
      {
        remaxReportedDate,
        remaxId,
        remaxMonthlyReported: formData.get("remaxMonthlyReported") === "on",
      },
      session.officeId,
    );
    redirect(`/deals/${dealId}`);
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("updateDealRemaxFieldsAction failed:", e);
    redirect(`/deals/${dealId}?error=save`);
  }
}

/**
 * Per-payment "reported to RE/MAX" checklist — admin-only, matching Red
 * File's subitem-level תשלום דיווח לרימקס checkbox. One form covers every
 * payment on the deal so a monthly reporting pass is a single save.
 */
export async function updateIncomeRemaxReportedAction(dealId: string, formData: FormData) {
  try {
    const session = await requireAdmin();
    const deal = await getDeal(dealId);
    if (!deal || deal.officeId !== session.officeId) throw new Error("NOT_FOUND");
    const incomeRows = await listIncomeForDeal(dealId);
    await Promise.all(
      incomeRows.map((r) =>
        updateIncome(
          r.id,
          { remaxMonthlyReported: formData.get(`remaxReported.${r.id}`) === "on" },
          session.officeId,
        ),
      ),
    );
    redirect(`/deals/${dealId}`);
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("updateIncomeRemaxReportedAction failed:", e);
    redirect(`/deals/${dealId}?error=save`);
  }
}

/**
 * Agent payout lifecycle (per-deal, only once fully paid — see Deal's own
 * doc comment and services/deals.ts). The deal's own agent may upload their
 * own חשבונית/קבלה; an admin may do either step on their behalf too.
 * Marking paid is admin-only (that's Ariyel).
 */
export async function uploadAgentInvoiceAction(dealId: string, formData: FormData) {
  try {
    const session = await requireSession();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      redirect(`/deals/${dealId}?error=save`);
    }
    const deal = await uploadDealAgentInvoice(
      dealId,
      session.officeId,
      session.agentId,
      isAdmin(session),
      file,
    );
    if (!deal) redirect(`/deals/${dealId}?error=save`);
    redirect(`/deals/${dealId}`);
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("uploadAgentInvoiceAction failed:", e);
    redirect(`/deals/${dealId}?error=save`);
  }
}

export async function markAgentPaidAction(dealId: string) {
  try {
    const session = await requireAdmin();
    const deal = await markDealAgentPaid(dealId, session.officeId);
    if (!deal) redirect(`/deals/${dealId}?error=save`);
    redirect(`/deals/${dealId}`);
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("markAgentPaidAction failed:", e);
    redirect(`/deals/${dealId}?error=save`);
  }
}

export async function uploadAgentReceiptAction(dealId: string, formData: FormData) {
  try {
    const session = await requireSession();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      redirect(`/deals/${dealId}?error=save`);
    }
    const deal = await uploadDealAgentReceipt(
      dealId,
      session.officeId,
      session.agentId,
      isAdmin(session),
      file,
    );
    if (!deal) redirect(`/deals/${dealId}?error=save`);
    redirect(`/deals/${dealId}`);
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("uploadAgentReceiptAction failed:", e);
    redirect(`/deals/${dealId}?error=save`);
  }
}
