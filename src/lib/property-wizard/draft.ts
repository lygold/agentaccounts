import "server-only";
import { getRedis, RedisKeys } from "../redis";
import { SESSION_TTL_SECONDS } from "../auth/session";
import type { PropertyRecord } from "../types";
import { advancePropertyFurthest, type PropertyWizardStep } from "./steps";

/**
 * One draft per agent, same storage pattern as src/lib/wizard/draft.ts
 * (deal wizard) — keyed by session agentId, read-modify-write the whole
 * blob per step. Unlike the deal wizard, the draft shape here IS just
 * `Partial<PropertyRecord>` rather than a bespoke parallel type:
 * PropertyRecord's fields were already designed as plain wizard-step
 * output (e.g. commissionPercent/commissionVatMode, not a nested
 * CommissionInput with internal-only referral math), so there's nothing a
 * separate draft shape would buy here.
 */
export interface PropertyDraft extends Partial<PropertyRecord> {
  furthestStep: PropertyWizardStep;
  /** Stamped by saveDraft() on every write — mirrors WizardDraft.updatedAt,
   *  same purpose (a future resume-prompt, not built yet for this wizard). */
  updatedAt?: string;
}

export function emptyPropertyDraft(): PropertyDraft {
  return { furthestStep: "deal-type" };
}

export async function loadPropertyDraft(agentId: string): Promise<PropertyDraft> {
  const raw = await getRedis().get<PropertyDraft | string>(RedisKeys.propertyWizardDraft(agentId));
  if (!raw) return emptyPropertyDraft();
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as PropertyDraft;
    } catch {
      return emptyPropertyDraft();
    }
  }
  return raw;
}

export async function savePropertyDraft(agentId: string, draft: PropertyDraft): Promise<void> {
  const stamped: PropertyDraft = { ...draft, updatedAt: new Date().toISOString() };
  await getRedis().set(RedisKeys.propertyWizardDraft(agentId), JSON.stringify(stamped), {
    ex: SESSION_TTL_SECONDS,
  });
}

export async function patchPropertyDraft(
  agentId: string,
  patch: Partial<PropertyDraft>,
): Promise<PropertyDraft> {
  const current = await loadPropertyDraft(agentId);
  const next: PropertyDraft = { ...current, ...patch };
  await savePropertyDraft(agentId, next);
  return next;
}

/** Merge a step's field patch AND advance `furthestStep` — every step page's
 *  server action calls this exactly once after validating its inputs. */
export async function advancePropertyDraft(
  agentId: string,
  fromStep: PropertyWizardStep,
  patch: Partial<Omit<PropertyDraft, "furthestStep">>,
): Promise<PropertyDraft> {
  const current = await loadPropertyDraft(agentId);
  const next: PropertyDraft = {
    ...current,
    ...patch,
    furthestStep: advancePropertyFurthest(fromStep, current.furthestStep),
  };
  await savePropertyDraft(agentId, next);
  return next;
}
