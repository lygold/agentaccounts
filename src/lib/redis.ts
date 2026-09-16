import "server-only";
import { Redis } from "@upstash/redis";

let _redis: Redis | null = null;

export function getRedis(): Redis {
  if (_redis) return _redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error(
      "Upstash Redis not configured: set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN",
    );
  }
  _redis = new Redis({ url, token });
  return _redis;
}

/** "al:" prefix on every key — lets this share a Redis instance with
 *  sikkumPigisha (same Upstash account) without colliding on OTP keys. */
export const RedisKeys = {
  otp: (contact: string) => `al:otp:${contact.toLowerCase()}`,
  otpAttempts: (contact: string) => `al:otp:attempts:${contact.toLowerCase()}`,
  otpLock: (contact: string) => `al:otp:lock:${contact.toLowerCase()}`,
  audit: (date: string) => `al:audit:${date}`,
  /** Dead-letter list for agent → Daf Kesher mirror writes that failed. */
  agentMirrorDeadletter: "al:sync:agent:deadletter",
  /** Idempotency guard per Green Invoice document id (stable across webhook
   *  retries — the delivery id is not). */
  giWebhookDoc: (giDocId: string) => `al:gi:webhook:doc:${giDocId}`,
  /** A parsed bulk-expense-import batch awaiting the manager's review. */
  expenseImportBatch: (token: string) => `al:expense:import:${token}`,
  /** Hash: normalised "<vendor>:<nickname>" → agentId, so a fixed match
   *  sticks for next month's import. */
  expenseImportAliases: "al:expense:import:aliases",
  /** The /sikkum deal wizard's in-progress draft, one per agent (keyed by
   *  our own session agentId — no separate draftId/JWT like sikkumPigisha
   *  had, since the agent is already authenticated into the real hub
   *  session by the time they reach the wizard). */
  wizardDraft: (agentId: string) => `al:wizard:draft:${agentId}`,
  /** Phase 9 property-intake wizard — separate draft/key from the deal
   *  wizard above (different field set, not a shared module). */
  propertyWizardDraft: (agentId: string) => `al:property-wizard:draft:${agentId}`,
};
