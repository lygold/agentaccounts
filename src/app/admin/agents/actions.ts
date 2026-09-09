"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session-cookie";
import { AgentFormSchema } from "@/lib/form-parse";
import { normalizePhone } from "@/lib/phone";
import {
  createAgent,
  listAgentsByOffice,
  setAgentStatus,
  updateAgent,
} from "@/lib/store/agents";
import { mirrorAgentToMonday, syncAgentsFromMonday } from "@/lib/sync/agents";
import { isNextJsRedirect } from "@/lib/action-utils";
import type { AgentStatus } from "@/lib/types";

const LIST = "/admin/agents";

function parseForm(formData: FormData) {
  return AgentFormSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
    role: formData.get("role"),
    team: formData.get("team") ?? "",
    isTeamLeader: formData.get("isTeamLeader") === "on",
  });
}

/** Reject a contact already used by another agent in the office — a
 *  duplicate phone/email makes the login lookup ambiguous and locks the
 *  person out. */
async function contactClash(
  officeId: string,
  email: string | undefined,
  phone: string | undefined,
  ignoreId?: string,
): Promise<boolean> {
  const wantedEmail = email?.toLowerCase();
  const wantedPhone = phone ? normalizePhone(phone) : undefined;
  const all = await listAgentsByOffice(officeId, { includeArchived: true });
  return all.some(
    (a) =>
      a.id !== ignoreId &&
      ((wantedEmail && a.email === wantedEmail) ||
        (wantedPhone && a.phone === wantedPhone)),
  );
}

export async function createAgentAction(formData: FormData) {
  try {
    const session = await requireAdmin();
    const parsed = parseForm(formData);
    if (!parsed.success) {
      redirect(`${LIST}?error=invalid`);
    }
    const d = parsed.data;
    if (await contactClash(session.officeId, d.email, d.phone)) {
      redirect(`${LIST}?error=duplicate`);
    }
    const created = await createAgent({
      officeId: session.officeId,
      name: d.name,
      email: d.email ?? null,
      phone: d.phone ? normalizePhone(d.phone) : null,
      role: d.role,
      team: d.team ?? null,
      isTeamLeader: d.isTeamLeader,
    });
    await mirrorAgentToMonday(created); // never throws — dead-letters on failure
    redirect(LIST);
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("createAgentAction failed:", e);
    redirect(`${LIST}?error=save`);
  }
}

export async function updateAgentAction(id: string, formData: FormData) {
  try {
    const session = await requireAdmin();
    const parsed = parseForm(formData);
    if (!parsed.success) {
      redirect(`${LIST}/${id}?error=invalid`);
    }
    const d = parsed.data;
    if (await contactClash(session.officeId, d.email, d.phone, id)) {
      redirect(`${LIST}/${id}?error=duplicate`);
    }
    const updated = await updateAgent(id, {
      name: d.name,
      email: d.email ?? null,
      phone: d.phone ? normalizePhone(d.phone) : null,
      role: d.role,
      team: d.team ?? null,
      isTeamLeader: d.isTeamLeader,
    });
    if (!updated || updated.officeId !== session.officeId) {
      redirect(`${LIST}?error=notfound`);
    }
    await mirrorAgentToMonday(updated);
    redirect(LIST);
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("updateAgentAction failed:", e);
    redirect(`${LIST}/${id}?error=save`);
  }
}

export async function setAgentStatusAction(id: string, status: AgentStatus) {
  try {
    const session = await requireAdmin();
    if (id === session.agentId && status === "archived") {
      redirect(`${LIST}?error=self`);
    }
    const updated = await setAgentStatus(id, status);
    if (!updated || updated.officeId !== session.officeId) {
      redirect(`${LIST}?error=notfound`);
    }
    await mirrorAgentToMonday(updated);
    redirect(LIST);
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("setAgentStatusAction failed:", e);
    redirect(`${LIST}?error=save`);
  }
}

/** Pull the latest roster from Daf Kesher into the agents table (Phase 4d). */
export async function syncFromMondayAction() {
  try {
    await requireAdmin();
    const r = await syncAgentsFromMonday();
    const params = new URLSearchParams({
      synced: `${r.created}-${r.updated}-${r.archived}-${r.linked}`,
    });
    if (r.errors.length) params.set("syncErrors", String(r.errors.length));
    redirect(`${LIST}?${params.toString()}`);
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("syncFromMondayAction failed:", e);
    redirect(`${LIST}?error=sync`);
  }
}
