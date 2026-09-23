"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session-cookie";
import { getAgentById } from "@/lib/store/agents";
import { createReferral, updateReferral } from "@/lib/store/referrals";
import { sendReferralInviteTemplate, toMetaPhone } from "@/lib/waba/client";
import { mirrorReferralToMonday } from "@/lib/sync/referrals";
import { notifyBrokerOfReferral } from "@/lib/services/referral-notify";
import { isNextJsRedirect } from "@/lib/wizard/action-utils";

const Schema = z.object({
  direction: z.enum(["outgoing", "outgoing_internal", "incoming", "incoming_internal"]),
  receivingAgentId: z.string().min(1),
  clientName: z.string().trim().min(1),
  clientPhone: z.string().trim().optional(),
  clientEmail: z.string().trim().optional(),
  clientType: z.enum(["seller", "buyer", "landlord"]).optional(),
  notes: z.string().trim().optional(),
});

function orNull(v: string | undefined): string | null {
  return v && v.length > 0 ? v : null;
}

/** Creates the referral, then — for outgoing referrals only, per the Monday
 *  board's own "Check Outgoing" filter — sends the WhatsApp invite and
 *  flips status to sent/send_failed accordingly. The Monday mirror and
 *  broker ping are fire-and-forget and never block this action; a failure
 *  in either is logged, not surfaced to the creating agent. */
export async function submitNewReferral(formData: FormData) {
  try {
    const session = await requireSession();
    const parsed = Schema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) redirect("/referrals/new?error=save");
    const d = parsed.data;

    const receivingAgent = await getAgentById(d.receivingAgentId);
    if (!receivingAgent || receivingAgent.officeId !== session.officeId) {
      redirect("/referrals/new?error=save");
    }

    let referral = await createReferral({
      officeId: session.officeId,
      dealId: null,
      sendingAgentId: session.agentId,
      receivingAgentId: d.receivingAgentId,
      direction: d.direction,
      clientType: d.clientType ?? null,
      clientName: d.clientName,
      clientPhone: orNull(d.clientPhone),
      clientEmail: orNull(d.clientEmail),
      notes: orNull(d.notes),
      status: "new",
      respondedAt: null,
      respondedIp: null,
      consentTextShown: null,
      consentVersion: null,
      mondayItemId: null,
    });

    const isOutgoing = d.direction === "outgoing" || d.direction === "outgoing_internal";
    if (isOutgoing) {
      if (!receivingAgent.phone) {
        console.error(`[referrals/new] ${receivingAgent.id} has no phone — cannot send invite`);
        referral =
          (await updateReferral(referral.id, { status: "send_failed" }, session.officeId)) ?? referral;
      } else {
        try {
          await sendReferralInviteTemplate(
            toMetaPhone(receivingAgent.phone),
            receivingAgent.name,
            session.agentName,
            referral.id,
          );
          referral = (await updateReferral(referral.id, { status: "sent" }, session.officeId)) ?? referral;
        } catch (e) {
          console.error("[referrals/new] invite send failed:", e);
          referral =
            (await updateReferral(referral.id, { status: "send_failed" }, session.officeId)) ?? referral;
        }
      }
    }

    const sendingAgent = await getAgentById(session.agentId);
    if (sendingAgent) {
      void mirrorReferralToMonday(referral, sendingAgent, receivingAgent);
      void notifyBrokerOfReferral(referral, sendingAgent, receivingAgent);
    }

    redirect("/referrals");
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("submitNewReferral failed:", e);
    redirect("/referrals/new?error=save");
  }
}
