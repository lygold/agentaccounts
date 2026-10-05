import "server-only";
import { redirect } from "next/navigation";
import {
  advancePropertyDraft,
  loadPropertyDraft,
  savePropertyDraft,
  type PropertyDraft,
} from "./draft";
import { missingForStep, missingQuery } from "./required";
import { nextPropertyStep, propertyDestinationStep, propertyStepHref, type PropertyWizardStep } from "./steps";

/**
 * The common ending of every wizard step action: merge the step's answers into
 * the draft; if any mandatory question on this step is still unanswered, keep
 * what was typed but stay on the step and list what's missing; otherwise
 * advance to the next step (or back to the review when the agent came from it).
 * Always redirects.
 */
export async function saveStepOrReportMissing(
  agentId: string,
  step: PropertyWizardStep,
  patch: Partial<Omit<PropertyDraft, "furthestStep">>,
  destination?: string | null,
): Promise<never> {
  const current = await loadPropertyDraft(agentId);
  const merged = { ...current, ...patch };
  const missing = missingForStep(step, merged);

  if (missing.length > 0) {
    await savePropertyDraft(agentId, merged);
    redirect(propertyStepHref(step) + missingQuery(missing));
  }

  await advancePropertyDraft(agentId, step, patch);
  redirect(propertyStepHref(destination ? propertyDestinationStep(step, destination) : nextPropertyStep(step)!));
}
