/**
 * Canonical ordered list of wizard steps. Each step is a slug under /form/.
 * Used by the layout (progress bar), middleware (access checks), and
 * navigation helpers (next/prev).
 *
 * Excludes the auth pages (`contact`, `otp`) and the success page (`done`).
 */
export const WIZARD_STEPS = [
  "language",
  "deal-type",
  "signing-date",
  "representation",
  "other-side",
  "property",
  "price-terms",
  "owners",
  "owner-commission",
  "owner-lawyer",
  "owner-agent",
  "buyers",
  "buyer-commission",
  "buyer-lawyer",
  "buyer-agent",
  "notes",
  "office-notes",
  "review",
] as const;

export type WizardStep = (typeof WIZARD_STEPS)[number];

/**
 * Every step page renders exactly one <form>, given this id, so the "back to
 * summary" button in WizardChrome — which lives outside that form in the DOM
 * — can still submit it via the HTML `form="..."` attribute. Only one step
 * form is ever mounted at a time, so a single shared id is safe.
 */
export const WIZARD_FORM_ID = "wizard-step-form";

/** Name of the submit-button field the destination question below reads. */
export const WIZARD_DESTINATION_FIELD = "wizardDestination";

export function isWizardStep(s: string): s is WizardStep {
  return (WIZARD_STEPS as readonly string[]).includes(s);
}

export function stepIndex(s: WizardStep): number {
  return WIZARD_STEPS.indexOf(s);
}

export function nextStep(s: WizardStep): WizardStep | null {
  const i = stepIndex(s);
  return i >= 0 && i < WIZARD_STEPS.length - 1 ? WIZARD_STEPS[i + 1] : null;
}

/**
 * Where to send the user after a step's form submits. `requestedDestination`
 * comes straight from the submit control that was clicked (a name/value pair
 * on the button, read from FormData) — "review" only when the agent
 * explicitly clicked "back to summary", never inferred from draft state.
 * Continue always advances regardless of furthestStep.
 */
export function destinationStep(
  fromStep: WizardStep,
  requestedDestination: string | null,
): WizardStep {
  if (requestedDestination === "review") return "review";
  return nextStep(fromStep) ?? fromStep;
}

export function prevStep(s: WizardStep): WizardStep | null {
  const i = stepIndex(s);
  return i > 0 ? WIZARD_STEPS[i - 1] : null;
}

export function stepHref(s: WizardStep): string {
  return `/form/${s}`;
}

/**
 * Returns the highest step the user has reached. Used to gate access — they
 * can revisit any completed step but can't skip ahead via URL manipulation.
 */
export function canAccessStep(
  requested: WizardStep,
  furthest: WizardStep,
): boolean {
  return stepIndex(requested) <= stepIndex(furthest);
}

/**
 * Compute the new `furthestStep` value after the user submits `currentStep`.
 * Walks forward monotonically — going back to revise an earlier step never
 * regresses the furthest pointer.
 */
export function advanceFurthest(
  currentStep: WizardStep,
  currentFurthest: WizardStep,
): WizardStep {
  const proposed = nextStep(currentStep) ?? currentStep;
  return stepIndex(proposed) > stepIndex(currentFurthest)
    ? proposed
    : currentFurthest;
}
