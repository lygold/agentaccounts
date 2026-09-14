import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session-cookie";
import { loadDraft } from "@/lib/wizard/draft";
import { stepHref } from "@/lib/wizard/steps";

/**
 * /deals/new is now the wizard's landing spot (Phase 8) — it replaces the
 * old manager-only quick form outright, it doesn't sit alongside it.
 * Managers use the same wizard agents do; there is no separate fast path.
 *
 * Bare /deals/new has no step of its own — it resumes an in-progress draft
 * where the agent left off, or starts a fresh one at the first step.
 *
 * TODO(8c): once the AI-extraction upload step lands, a brand-new draft
 * (furthestStep still at its default) should land on /deals/new/upload
 * instead of /deals/new/language — change the one line below, nothing else
 * reads this decision.
 */
export default async function NewDealEntryPage() {
  const session = await requireSession();
  const draft = await loadDraft(session.agentId);
  redirect(stepHref(draft.furthestStep));
}
