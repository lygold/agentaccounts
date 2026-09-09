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
};
