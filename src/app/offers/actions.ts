"use server";

import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session-cookie";
import { allowedAgentIds, isIdAllowed, sameOffice } from "@/lib/auth/scope";
import { getOffer, updateOffer } from "@/lib/store/offers";
import { isNextJsRedirect } from "@/lib/action-utils";
import type { OfferStatus } from "@/lib/types";

const VALID_STATUSES: OfferStatus[] = [
  "new",
  "follow_up",
  "accepted",
  "rejected_too_low",
  "rejected_not_relevant",
  "duplicate",
];

/** Staff triage — any session that can see the offer may change its status
 *  (matches how the rest of this app treats agent-visible list/status
 *  fields; unlike deal-signing there's no separate fraud-gate concern here). */
export async function updateOfferStatusAction(offerId: string, formData: FormData) {
  try {
    const session = await requireSession();
    const offer = await getOffer(offerId);
    if (!offer || !sameOffice(offer, session)) redirect(`/offers/${offerId}?error=save`);
    if (!isIdAllowed(await allowedAgentIds(session), offer.agentId)) {
      redirect(`/offers/${offerId}?error=save`);
    }

    const status = formData.get("status");
    if (typeof status !== "string" || !VALID_STATUSES.includes(status as OfferStatus)) {
      redirect(`/offers/${offerId}?error=save`);
    }

    await updateOffer(
      offerId,
      {
        status: status as OfferStatus,
        statusUpdatedAt: new Date().toISOString(),
        statusUpdatedBy: session.agentId,
      },
      session.officeId,
    );
    redirect(`/offers/${offerId}`);
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("updateOfferStatusAction failed:", e);
    redirect(`/offers/${offerId}?error=save`);
  }
}
