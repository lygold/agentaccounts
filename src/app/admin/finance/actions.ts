"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session-cookie";
import { createOfficeExpense } from "@/lib/store/office-expenses";
import { createRemaxIsraelReceipt } from "@/lib/store/remax-israel-receipts";
import { getAgentById } from "@/lib/store/agents";
import { importBankStatement } from "@/lib/services/finance";
import type { OfficeExpenseCategory } from "@/lib/types";
import { isNextJsRedirect } from "@/lib/action-utils";

const BASE = "/admin/finance";
const CATEGORIES: OfficeExpenseCategory[] = [
  "cc_fees",
  "municipal",
  "cleaning",
  "pension",
  "loan",
  "ad_vendor",
  "other",
];

export async function addOfficeExpenseAction(formData: FormData) {
  try {
    const session = await requireAdmin();
    const category = String(formData.get("category") ?? "other") as OfficeExpenseCategory;
    const description = String(formData.get("description") ?? "").trim();
    const amount = Number(formData.get("amount"));
    const date = String(formData.get("date") ?? "");
    if (
      !CATEGORIES.includes(category) ||
      !description ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date)
    ) {
      redirect(`${BASE}?error=invalid`);
    }
    await createOfficeExpense({ officeId: session.officeId, category, description, amount, date });
    redirect(`${BASE}?done=office`);
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("addOfficeExpenseAction failed:", e);
    redirect(`${BASE}?error=save`);
  }
}

export async function addRemaxIsraelReceiptAction(formData: FormData) {
  try {
    const session = await requireAdmin();
    const agentId = String(formData.get("agentId") ?? "");
    const agent = await getAgentById(agentId);
    if (!agent || agent.officeId !== session.officeId) redirect(`${BASE}?error=invalid`);

    const clientName = String(formData.get("clientName") ?? "").trim();
    const grossAmount = Number(formData.get("grossAmount"));
    const receivedAmount = Number(formData.get("receivedAmount"));
    const invoiceNumber = String(formData.get("invoiceNumber") ?? "").trim();
    const date = String(formData.get("date") ?? "");
    const notes = String(formData.get("notes") ?? "").trim();
    if (
      !clientName ||
      !Number.isFinite(grossAmount) ||
      !Number.isFinite(receivedAmount) ||
      !invoiceNumber ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date)
    ) {
      redirect(`${BASE}?error=invalid`);
    }
    await createRemaxIsraelReceipt({
      officeId: session.officeId,
      date,
      clientName,
      agentId,
      agentName: agent.name,
      grossAmount,
      receivedAmount,
      invoiceNumber,
      notes: notes || undefined,
    });
    redirect(`${BASE}?done=remax`);
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("addRemaxIsraelReceiptAction failed:", e);
    redirect(`${BASE}?error=save`);
  }
}

export async function importBankAction(formData: FormData) {
  try {
    const session = await requireAdmin();
    const pasted = String(formData.get("pasted") ?? "");
    if (!pasted.trim()) redirect(`${BASE}?error=empty`);
    const result = await importBankStatement(session.officeId, pasted);
    if (result.rows === 0) redirect(`${BASE}?error=norows`);
    redirect(`${BASE}?bankDone=${result.inserted}-${result.skipped}-${result.days}`);
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("importBankAction failed:", e);
    redirect(`${BASE}?error=save`);
  }
}
