import "server-only";
import { listReferralsByOffice, updateReferral } from "../store/referrals";
import { getAgentById } from "../store/agents";
import { sendReferralDeclinedTemplate, toMetaPhone } from "../waba/client";
import { mirrorReferralToMonday } from "../sync/referrals";
import { DEFAULT_OFFICE_ID } from "../office";
import type { ReferralRecord } from "../types";

/**
 * No reject button/link — per Levi, an outgoing referral just has a
 * 48-hour response window; no response in that window is treated the same
 * as an explicit decline. Distinguishing the two in storage costs nothing
 * extra: an active decline always has `respondedAt` set (from
 * src/app/r/[id]/actions.ts's declineReferral); an expiry never does,
 * since nobody ever visited/responded. Same `status: "declined"` either
 * way — only the reason text in the sender's WhatsApp notice differs.
 */
export const REFERRAL_RESPONSE_WINDOW_HOURS = 48;

const RESPONDABLE_STATUSES: ReadonlyArray<ReferralRecord["status"]> = ["new", "sent", "send_failed"];

export function isReferralExpired(referral: ReferralRecord): boolean {
  if (!RESPONDABLE_STATUSES.includes(referral.status)) return false;
  const ageMs = Date.now() - new Date(referral.createdAt).getTime();
  return ageMs > REFERRAL_RESPONSE_WINDOW_HOURS * 60 * 60 * 1000;
}

/** Flips one stale referral to declined (respondedAt left null — that's
 *  the "nobody ever responded" marker) and notifies the sending agent.
 *  Used both by the lazy defensive check (someone opens/acts on a stale
 *  /r/[id] link before the cron has swept it) and by the active sweep
 *  below. Never throws — same "log, don't block" convention as the rest of
 *  this feature's notification sends. */
export async function expireReferral(referral: ReferralRecord): Promise<ReferralRecord> {
  const updated = (await updateReferral(referral.id, { status: "declined" })) ?? referral;

  const [sendingAgent, receivingAgent] = await Promise.all([
    getAgentById(referral.sendingAgentId),
    getAgentById(referral.receivingAgentId),
  ]);
  if (sendingAgent?.phone && receivingAgent) {
    try {
      await sendReferralDeclinedTemplate(
        toMetaPhone(sendingAgent.phone),
        sendingAgent.name,
        receivingAgent.name,
        `לא התקבלה תגובה תוך ${REFERRAL_RESPONSE_WINDOW_HOURS} שעות`,
      );
    } catch (e) {
      console.error("[referral-expiry] sender notice failed:", e);
    }
  }
  if (sendingAgent && receivingAgent) {
    void mirrorReferralToMonday(updated, sendingAgent, receivingAgent);
  }
  return updated;
}

/** The active sweep — POSTed to by a daily cron (same shape as
 *  /api/sync/properties), so a referral nobody ever revisits still gets
 *  flipped and its sender still gets told, rather than sitting in "sent"
 *  forever with no signal. The lazy check in isReferralExpired /
 *  src/app/r/[id]'s own load path is the defensive backstop for the gap
 *  between when a referral goes stale and the next time this cron runs. */
export async function expireStaleReferrals(): Promise<{ expired: number }> {
  const referrals = await listReferralsByOffice(DEFAULT_OFFICE_ID);
  const stale = referrals.filter(isReferralExpired);
  for (const referral of stale) {
    await expireReferral(referral);
  }
  return { expired: stale.length };
}
