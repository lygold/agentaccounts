/**
 * Canonical ordered list of property-wizard steps — same shape as
 * src/lib/wizard/steps.ts (deal wizard) but a separate list/module: the
 * field sets don't overlap, so this isn't a shared step machinery, just an
 * identical pattern copied over. Each step is a slug under
 * /properties/new/.
 *
 * Full order per the Phase 9 plan (built incrementally — see ROADMAP.md;
 * steps not yet built redirect back to the furthest one that exists).
 */
export const PROPERTY_WIZARD_STEPS = [
  "deal-type",
  "contract-pick",
  "address",
  "commission",
  "details",
  "media",
  "descriptions",
  "technical",
  "ratings",
  "review",
] as const;

export type PropertyWizardStep = (typeof PROPERTY_WIZARD_STEPS)[number];

/** Same one-form-per-page convention as WIZARD_FORM_ID (deal wizard). */
export const PROPERTY_WIZARD_FORM_ID = "property-wizard-step-form";
export const PROPERTY_WIZARD_DESTINATION_FIELD = "wizardDestination";

export function isPropertyWizardStep(s: string): s is PropertyWizardStep {
  return (PROPERTY_WIZARD_STEPS as readonly string[]).includes(s);
}

export function propertyStepIndex(s: PropertyWizardStep): number {
  return PROPERTY_WIZARD_STEPS.indexOf(s);
}

export function nextPropertyStep(s: PropertyWizardStep): PropertyWizardStep | null {
  const i = propertyStepIndex(s);
  return i >= 0 && i < PROPERTY_WIZARD_STEPS.length - 1 ? PROPERTY_WIZARD_STEPS[i + 1] : null;
}

export function prevPropertyStep(s: PropertyWizardStep): PropertyWizardStep | null {
  const i = propertyStepIndex(s);
  return i > 0 ? PROPERTY_WIZARD_STEPS[i - 1] : null;
}

export function propertyStepHref(s: PropertyWizardStep): string {
  return `/properties/new/${s}`;
}

export function propertyDestinationStep(
  fromStep: PropertyWizardStep,
  requestedDestination: string | null,
): PropertyWizardStep {
  if (requestedDestination === "review") return "review";
  return nextPropertyStep(fromStep) ?? fromStep;
}

export function canAccessPropertyStep(
  requested: PropertyWizardStep,
  furthest: PropertyWizardStep,
): boolean {
  return propertyStepIndex(requested) <= propertyStepIndex(furthest);
}

export function advancePropertyFurthest(
  currentStep: PropertyWizardStep,
  currentFurthest: PropertyWizardStep,
): PropertyWizardStep {
  const proposed = nextPropertyStep(currentStep) ?? currentStep;
  return propertyStepIndex(proposed) > propertyStepIndex(currentFurthest)
    ? proposed
    : currentFurthest;
}
