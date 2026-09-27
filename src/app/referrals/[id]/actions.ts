"use server";

import { redirect, notFound } from "next/navigation";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session-cookie";
import { canSeeReferral } from "@/lib/auth/scope";
import { getReferral, updateReferral } from "@/lib/store/referrals";
import { isNextJsRedirect } from "@/lib/wizard/action-utils";
import type { ReferralActivityEntry } from "@/lib/types";

const NoteSchema = z.object({ referralId: z.string().min(1), body: z.string().trim().min(1) });
const StatusSchema = z.object({ referralId: z.string().min(1), leadStatus: z.string().trim() });

/** Client info (name/phone/email/type/notes-from-creation) is deliberately
 *  never editable from here — per Levi, this is a read-only record of what
 *  was handed off; only the ongoing check-in log and lead status are. */
export async function addReferralNote(formData: FormData) {
  const referralId = String(formData.get("referralId") ?? "");
  try {
    const session = await requireSession();
    const parsed = NoteSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) redirect(`/referrals/${referralId}?error=note`);
    const d = parsed.data;

    const referral = await getReferral(d.referralId);
    if (!referral) notFound();
    if (!(await canSeeReferral(session, referral))) notFound();

    const entry: ReferralActivityEntry = {
      id: randomUUID(),
      authorId: session.agentId,
      authorName: session.agentName,
      body: d.body,
      createdAt: new Date().toISOString(),
    };
    await updateReferral(
      referral.id,
      { activityLog: [...referral.activityLog, entry] },
      referral.officeId,
    );

    redirect(`/referrals/${referral.id}`);
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("addReferralNote failed:", e);
    redirect(`/referrals/${referralId}?error=note`);
  }
}

export async function updateReferralLeadStatus(formData: FormData) {
  const referralId = String(formData.get("referralId") ?? "");
  try {
    const session = await requireSession();
    const parsed = StatusSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) redirect(`/referrals/${referralId}?error=status`);
    const d = parsed.data;

    const referral = await getReferral(d.referralId);
    if (!referral) notFound();
    if (!(await canSeeReferral(session, referral))) notFound();

    await updateReferral(
      referral.id,
      { leadStatus: d.leadStatus.length > 0 ? d.leadStatus : null },
      referral.officeId,
    );

    redirect(`/referrals/${referral.id}`);
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("updateReferralLeadStatus failed:", e);
    redirect(`/referrals/${referralId}?error=status`);
  }
}
