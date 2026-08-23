import "server-only";
import { createHmac, randomInt } from "node:crypto";
import { getRedis, RedisKeys } from "../redis";

const OTP_TTL_SECONDS = 10 * 60;
const LOCK_TTL_SECONDS = 60 * 60;

export function generateOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export async function storeOtp(contact: string, code: string): Promise<void> {
  const hash = hashOtp(contact, code);
  await getRedis().set(RedisKeys.otp(contact), hash, { ex: OTP_TTL_SECONDS });
  await getRedis().del(RedisKeys.otpAttempts(contact));
}

export async function verifyOtp(contact: string, code: string): Promise<boolean> {
  const stored = await getRedis().get<string>(RedisKeys.otp(contact));
  if (!stored) return false;
  const matches = stored === hashOtp(contact, code);
  if (matches) {
    await getRedis().del(RedisKeys.otp(contact));
    await getRedis().del(RedisKeys.otpAttempts(contact));
  }
  return matches;
}

export async function isContactLocked(contact: string): Promise<boolean> {
  const v = await getRedis().get<string>(RedisKeys.otpLock(contact));
  return v === "1";
}

export async function lockContact(contact: string): Promise<void> {
  await getRedis().set(RedisKeys.otpLock(contact), "1", { ex: LOCK_TTL_SECONDS });
}

export async function recordBadAttempt(contact: string): Promise<number> {
  const key = RedisKeys.otpAttempts(contact);
  const n = await getRedis().incr(key);
  if (n === 1) await getRedis().expire(key, OTP_TTL_SECONDS);
  return n;
}

function hashOtp(contact: string, code: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return createHmac("sha256", secret)
    .update(`${contact.toLowerCase()}:${code}`)
    .digest("hex");
}
