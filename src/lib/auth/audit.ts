import "server-only";
import { getRedis, RedisKeys } from "../redis";

export type AuditEvent =
  | { kind: "otp_request"; contact: string; matched: boolean; ip: string }
  | { kind: "otp_verify_ok"; agentId: string; role: string; ip: string }
  | { kind: "otp_verify_fail"; contact: string; attempt: number; ip: string }
  | { kind: "otp_locked"; contact: string; ip: string };

/** Append-only per-UTC-date Redis list, capped and expired — see
 *  sikkumPigisha's src/lib/auth/audit.ts for the identical pattern. */
export async function logAudit(event: AuditEvent): Promise<void> {
  const date = new Date().toISOString().slice(0, 10);
  const key = RedisKeys.audit(date);
  const payload = JSON.stringify({ ts: Date.now(), ...event });
  try {
    await getRedis().lpush(key, payload);
    await getRedis().ltrim(key, 0, 49_999);
    await getRedis().expire(key, 60 * 60 * 24 * 90);
  } catch {
    // Audit failures must never break the login flow.
  }
}
