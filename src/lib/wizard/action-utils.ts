/**
 * Shared result type and helpers for wizard step server actions. Ported from
 * sikkumPigisha's src/lib/wizard-action-utils.ts — `isNextJsRedirect` already
 * exists identically in agentLedger's own action-utils.ts, so it's
 * re-exported from there instead of duplicated.
 */
export { isNextJsRedirect } from "../action-utils";

/** Returned by wizard step actions on failure. undefined = not yet run. */
export type WizardActionResult =
  | { ok: false; message: string }
  | undefined;
