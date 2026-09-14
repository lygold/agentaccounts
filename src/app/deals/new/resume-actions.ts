"use server";

import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session-cookie";
import { emptyDraft, loadDraft, saveDraft } from "@/lib/wizard/draft";
import { stepHref } from "@/lib/wizard/steps";

/** "Continue where I left off" — the resume-prompt page's default action. */
export async function continueDraft() {
  const session = await requireSession();
  const draft = await loadDraft(session.agentId);
  redirect(stepHref(draft.furthestStep));
}

/** "Start a new one" — wipes the stale draft and begins from the first step. */
export async function startFreshDraft() {
  const session = await requireSession();
  await saveDraft(session.agentId, emptyDraft());
  redirect(stepHref(emptyDraft().furthestStep));
}
