"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { getAgentById } from "@/lib/store/agents";
import { getReferral, updateReferral } from "@/lib/store/referrals";
import {
  sendReferralAcceptedTemplate,
  sendReferralDeclinedTemplate,
  sendReferralDetailsTemplate,
  toMetaPhone,
} from "@/lib/waba/client";
import { mirrorReferralToMonday } from "@/lib/sync/referrals";
import { isReferralExpired, expireReferral } from "@/lib/services/referral-expiry";
import { STATUS_LABELS } from "@/lib/wizard/monday/columns";
import { REFERRAL_CONSENT_TEXT_HE, REFERRAL_CONSENT_VERSION } from "@/lib/referral-consent";
import { isNextJsRedirect } from "@/lib/wizard/action-utils";
import type { AgentRecord, ReferralRecord } from "@/lib/types";

/** Same x-forwarded-for/x-real-ip read as src/lib/auth/actions.ts's OTP
 *  flow — stamped on the referral for the accept/decline evidentiary
 *  record, not used for any access decision. */
async function getClientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "unknown";
}

const CLIENT_TYPE_LABEL: Record<NonNullable<ReferralRecord["clientType"]>, string> = {
  seller: STATUS_LABELS.referralClientType.seller,
  buyer: STATUS_LABELS.referralClientType.buyer,
  landlord: STATUS_LABELS.referralClientType.landlord,
};

const Schema = z.object({ referralId: z.string().min(1) });

/** No session — this is the unauthenticated public link the WhatsApp invite
 *  opens. `getById` on an opaque UUID is the only "auth": there's nothing
 *  to enumerate. Idempotent: a referral that's already responded to (via a
 *  stale re-opened link) is left alone, no re-send. */
interface Respondable {
  referral: ReferralRecord;
  sendingAgent: AgentRecord;
  receivingAgent: AgentRecord;
}

async function loadRespondable(formData: FormData): Promise<Respondable | null> {
  const parsed = Schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return null;
  const referral = await getReferral(parsed.data.referralId);
  if (!referral || (referral.status !== "new" && referral.status !== "sent" && referral.status !== "send_failed")) {
    return null;
  }
  // Defensive backstop for the gap between a referral going stale and the
  // next daily cron sweep (src/lib/services/referral-expiry.ts) — someone
  // acting on a >48h-old link gets treated as expired right here, rather
  // than being allowed to accept/decline past the window.
  if (isReferralExpired(referral)) {
    await expireReferral(referral);
    return null;
  }
  const [sendingAgent, receivingAgent] = await Promise.all([
    getAgentById(referral.sendingAgentId),
    getAgentById(referral.receivingAgentId),
  ]);
  if (!sendingAgent || !receivingAgent) return null;
  return { referral, sendingAgent, receivingAgent };
}

export async function acceptReferral(formData: FormData) {
  const referralId = String(formData.get("referralId") ?? "");
  try {
    // Server-side consent check — the page's checkbox `required` attribute
    // is only a client-side nicety; a direct POST (curl, a replayed
    // request) could otherwise skip it entirely. This is the record that
    // matters if a receiving agent ever disputes having agreed to the fee.
    if (formData.get("consent") !== "on") redirect(`/r/${referralId}`);

    const loaded = await loadRespondable(formData);
    if (!loaded) redirect(`/r/${referralId}`);
    const { referral, sendingAgent, receivingAgent } = loaded;

    const updated =
      (await updateReferral(referral.id, {
        status: "accepted",
        respondedAt: new Date().toISOString(),
        respondedIp: await getClientIp(),
        consentTextShown: REFERRAL_CONSENT_TEXT_HE,
        consentVersion: REFERRAL_CONSENT_VERSION,
      })) ?? referral;

    if (receivingAgent.phone) {
      try {
        await sendReferralDetailsTemplate(toMetaPhone(receivingAgent.phone), {
          receivingAgentName: receivingAgent.name,
          clientName: referral.clientName,
          clientPhone: referral.clientPhone ?? "",
          clientEmail: referral.clientEmail ?? "",
          clientType: referral.clientType ? CLIENT_TYPE_LABEL[referral.clientType] : "",
          notes: referral.notes ?? "אין הערות נוספות",
          sendingAgentName: sendingAgent.name,
        });
      } catch (e) {
        console.error("[r/accept] details send failed:", e);
      }
    }
    if (sendingAgent.phone) {
      try {
        await sendReferralAcceptedTemplate(
          toMetaPhone(sendingAgent.phone),
          sendingAgent.name,
          receivingAgent.name,
        );
      } catch (e) {
        console.error("[r/accept] sender confirmation failed:", e);
      }
    }

    void mirrorReferralToMonday(updated, sendingAgent, receivingAgent);

    redirect(`/r/${referral.id}`);
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("acceptReferral failed:", e);
    redirect(`/r/${referralId}`);
  }
}

/** New behavior, not in the original Monday/Make flow — it never handled a
 *  decline. No client details are ever sent on this path. */
export async function declineReferral(formData: FormData) {
  const referralId = String(formData.get("referralId") ?? "");
  try {
    const loaded = await loadRespondable(formData);
    if (!loaded) redirect(`/r/${referralId}`);
    const { referral, sendingAgent, receivingAgent } = loaded;

    const updated =
      (await updateReferral(referral.id, {
        status: "declined",
        respondedAt: new Date().toISOString(),
        respondedIp: await getClientIp(),
      })) ?? referral;

    if (sendingAgent.phone) {
      try {
        await sendReferralDeclinedTemplate(
          toMetaPhone(sendingAgent.phone),
          sendingAgent.name,
          receivingAgent.name,
          "דחה/תה את ההפניה",
        );
      } catch (e) {
        console.error("[r/decline] sender notice failed:", e);
      }
    }

    void mirrorReferralToMonday(updated, sendingAgent, receivingAgent);

    redirect(`/r/${referral.id}`);
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("declineReferral failed:", e);
    redirect(`/r/${referralId}`);
  }
}
