"use server";

import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session-cookie";
import { getRedis, RedisKeys } from "@/lib/redis";
import { listAgentsByOffice } from "@/lib/store/agents";
import { parseExpenseCsv, type ParsedBatch } from "@/lib/expense-import";
import { commitExpenseImport } from "@/lib/services/expenses";
import { isNextJsRedirect } from "@/lib/action-utils";

const BASE = "/admin/expenses/import";

async function loadAliases(): Promise<Record<string, string>> {
  try {
    return (await getRedis().hgetall<Record<string, string>>(RedisKeys.expenseImportAliases)) ?? {};
  } catch {
    return {};
  }
}

export async function parseUploadAction(formData: FormData) {
  try {
    const session = await requireAdmin();
    const vendor = String(formData.get("vendor") ?? "").trim();
    const file = formData.get("file");
    const pasted = String(formData.get("pasted") ?? "");
    const csv = file instanceof File && file.size > 0 ? await file.text() : pasted;
    if (!vendor || !csv.trim()) redirect(`${BASE}?error=empty`);

    const agents = await listAgentsByOffice(session.officeId, { includeArchived: true });
    const batch = parseExpenseCsv(vendor, csv, agents, await loadAliases());
    if (batch.rows.length === 0) redirect(`${BASE}?error=norows`);

    const token = randomUUID();
    await getRedis().set(RedisKeys.expenseImportBatch(token), JSON.stringify(batch), {
      ex: 60 * 60,
    });
    redirect(`${BASE}?batch=${token}`);
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("parseUploadAction failed:", e);
    redirect(`${BASE}?error=parse`);
  }
}

export async function commitImportAction(token: string, formData: FormData) {
  try {
    const session = await requireAdmin();
    const raw = await getRedis().get<ParsedBatch | string>(RedisKeys.expenseImportBatch(token));
    if (!raw) redirect(`${BASE}?error=expired`);
    const batch: ParsedBatch = typeof raw === "string" ? JSON.parse(raw) : raw;

    const agents = await listAgentsByOffice(session.officeId, { includeArchived: true });
    const nameById = new Map(agents.map((a) => [a.id, a.name]));

    const rows = batch.rows.map((r) => {
      const chosen = String(formData.get(`agent_${r.n}`) ?? r.agentId ?? "");
      return {
        agentId: chosen,
        agentName: nameById.get(chosen) ?? "",
        date: r.date,
        qty: r.qty,
        unitCost: r.unitCost,
        rawAgent: r.rawAgent,
      };
    });

    // Remember any match the manager fixed, for next month's file.
    const aliasUpdates: Record<string, string> = {};
    for (const r of rows) {
      if (r.agentId) {
        aliasUpdates[`${batch.vendor}:${r.rawAgent}`.toLowerCase().replace(/\s+/g, " ").trim()] =
          r.agentId;
      }
    }
    try {
      if (Object.keys(aliasUpdates).length) {
        await getRedis().hset(RedisKeys.expenseImportAliases, aliasUpdates);
      }
    } catch (e) {
      console.error("alias save failed (non-fatal):", e);
    }

    const result = await commitExpenseImport(
      session.officeId,
      batch.vendor,
      rows.filter((r) => r.agentId),
    );
    await getRedis().del(RedisKeys.expenseImportBatch(token));
    redirect(`${BASE}?done=${result.created}-${result.skipped}`);
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("commitImportAction failed:", e);
    redirect(`${BASE}?error=commit`);
  }
}
