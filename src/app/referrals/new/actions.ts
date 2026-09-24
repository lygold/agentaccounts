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
  // Only one of these is actually required, depending on direction — see
  // the by-hand check below (outgoing_internal/incoming*: receivingAgentId
  // from the picker; plain outgoing: a hand-typed external agent).
  receivingAgentId: z.string().trim().optional(),
  receivingAgentName: z.string().trim().optional(),
  receivingAgentPhone: z.string().trim().optional(),
  receivingAgentOffice: z.string().trim().optional(),
  receivingAgentEmail: z.string().trim().optional(),
  clientName: z.string().trim().min(1),
  clientPhone: z.string().trim().min(1),
  clientEmail: z.string().trim().optional(),
  clientType: z.enum(["seller", "buyer", "landlord", "renter"]),
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

    // Plain "outgoing" = an external agent/office, not in our own agents
    // table at all — hand-typed, same fields the old Monday board captured
    // by hand. "outgoing_internal" (and incoming*, unchanged) still picks
    // a real AgentRecord from this office's roster.
    let receivingParty: { name: string; phone: string | null };
    let receivingAgentId: string | null = null;
    if (d.direction === "outgoing") {
      if (!d.receivingAgentName) redirect("/referrals/new?error=save");
      receivingParty = { name: d.receivingAgentName, phone: orNull(d.receivingAgentPhone) };
    } else {
      if (!d.receivingAgentId) redirect("/referrals/new?error=save");
      const receivingAgent = await getAgentById(d.receivingAgentId);
      if (!receivingAgent || receivingAgent.officeId !== session.officeId) {
        redirect("/referrals/new?error=save");
      }
      receivingAgentId = d.receivingAgentId;
      receivingParty = { name: receivingAgent.name, phone: receivingAgent.phone };
    }

    let referral = await createReferral({
      officeId: session.officeId,
      dealId: null,
      sendingAgentId: session.agentId,
      receivingAgentId,
      receivingAgentName: d.direction === "outgoing" ? receivingParty.name : null,
      receivingAgentPhone: d.direction === "outgoing" ? receivingParty.phone : null,
      receivingAgentOffice: d.direction === "outgoing" ? orNull(d.receivingAgentOffice) : null,
      receivingAgentEmail: d.direction === "outgoing" ? orNull(d.receivingAgentEmail) : null,
      direction: d.direction,
      clientType: d.clientType,
      clientName: d.clientName,
      clientPhone: d.clientPhone,
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
      if (!receivingParty.phone) {
        console.error(`[referrals/new] ${referral.id} has no receiving phone — cannot send invite`);
        referral =
          (await updateReferral(referral.id, { status: "send_failed" }, session.officeId)) ?? referral;
      } else {
        try {
          await sendReferralInviteTemplate(
            toMetaPhone(receivingParty.phone),
            receivingParty.name,
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
      void mirrorReferralToMonday(referral, sendingAgent, receivingParty);
      void notifyBrokerOfReferral(referral, sendingAgent, receivingParty);
    }

    redirect("/referrals");
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("submitNewReferral failed:", e);
    redirect("/referrals/new?error=save");
  }
}
