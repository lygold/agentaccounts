import "server-only";
import { sendNotificationEmail } from "../email/notification-webhook";
import { sendBrokerReferralTemplate, toMetaPhone } from "../waba/client";
import type { AgentRecord, ReferralRecord } from "../types";

/**
 * Broker (Ariel) office-wide visibility ping — replaces the Monday board's
 * native "when item is created, notify Ariyel" automation. Creation only,
 * for now (per Levi: status-change notifications may come later, but this
 * pass matches what the board automation already does today). Same
 * "never block the caller, never throw" contract as
 * src/lib/services/property-notify.ts's channel sends — a failed channel
 * is logged, not fatal to the referral creation it's attached to.
 *
 * No broker role/contact exists anywhere else in the app (checked
 * AgentRecord, AppRole) — BROKER_PHONE/BROKER_EMAIL are a single office-wide
 * contact, same shape as SECRETARY_PHONE/SECRETARY_EMAIL.
 */
export async function notifyBrokerOfReferral(
  referral: ReferralRecord,
  sendingAgent: AgentRecord,
  receivingAgent: AgentRecord,
): Promise<void> {
  const phone = process.env.BROKER_PHONE;
  if (phone) {
    try {
      await sendBrokerReferralTemplate(
        toMetaPhone(phone),
        sendingAgent.name,
        receivingAgent.name,
        referral.clientName,
      );
    } catch (e) {
      console.error("[referral-notify] broker whatsapp failed:", e);
    }
  } else {
    console.info("[referral-notify] BROKER_PHONE not set — skipping whatsapp");
  }

  const email = process.env.BROKER_EMAIL;
  if (email) {
    try {
      await sendNotificationEmail({
        to: email,
        subject: `הפניה חדשה: ${referral.clientName}`,
        body:
          `${sendingAgent.name} העביר/ה הפניה ל${receivingAgent.name}.\n\n` +
          `לקוח: ${referral.clientName}\n` +
          `כיוון: ${referral.direction}\n` +
          (referral.notes ? `הערות: ${referral.notes}` : ""),
      });
    } catch (e) {
      console.error("[referral-notify] broker email failed:", e);
    }
  } else {
    console.info("[referral-notify] BROKER_EMAIL not set — skipping email");
  }
}
