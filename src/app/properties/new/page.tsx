import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session-cookie";
import { loadPropertyDraft } from "@/lib/property-wizard/draft";
import { propertyStepHref } from "@/lib/property-wizard/steps";

/**
 * Entry point — sends the agent to their furthest reached step (a fresh
 * draft's furthest is "deal-type", so a brand-new listing starts there).
 * No resume-vs-fresh prompt yet (the deal wizard's /deals/new added one
 * later, in response to live-testing feedback) — a reasonable follow-up
 * once this wizard has real usage to learn from, not before.
 */
export default async function NewPropertyPage() {
  const session = await requireSession();
  const draft = await loadPropertyDraft(session.agentId);
  redirect(propertyStepHref(draft.furthestStep));
}
