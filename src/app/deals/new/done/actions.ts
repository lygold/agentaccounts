"use server";

import { redirect } from "next/navigation";
import { emptyDraft, saveDraft } from "@/lib/wizard/draft";
import { getSession } from "@/lib/auth/session-cookie";
import { logout } from "@/app/logout/actions";

/**
 * Start a new deal under the SAME session — no OTP. Ported from
 * sikkumPigisha's done/actions.ts, simplified by the agentId-keyed draft
 * store (Phase 8a): sikkumPigisha minted a fresh random draftId and re-signed
 * the session cookie to carry it; here the draft is already keyed by
 * session.agentId, so "start fresh" is just resetting that same key to an
 * empty draft — no new draftId, no session re-mint needed.
 *
 * If the session has since expired, falls back to the normal login flow.
 */
export async function continueAsAgent() {
  const session = await getSession();
  if (!session) {
    redirect("/login?next=/deals/new");
  }

  await saveDraft(session.agentId, emptyDraft());
  redirect("/deals/new");
}

/** Explicit end-of-session — reuses agentLedger's own logout action so a
 *  shared device doesn't sit logged in as this agent. */
export async function endSession() {
  await logout();
}
