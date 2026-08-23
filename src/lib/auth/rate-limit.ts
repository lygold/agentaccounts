import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { getRedis } from "../redis";

let _otpSendLimiter: Ratelimit | null = null;
let _otpVerifyLimiter: Ratelimit | null = null;

export function otpSendLimiter(): Ratelimit {
  if (!_otpSendLimiter) {
    _otpSendLimiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(3, "15 m"),
      prefix: "al:rl:otp:send",
      analytics: false,
    });
  }
  return _otpSendLimiter;
}

export function otpVerifyLimiter(): Ratelimit {
  if (!_otpVerifyLimiter) {
    _otpVerifyLimiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(5, "10 m"),
      prefix: "al:rl:otp:verify",
      analytics: false,
    });
  }
  return _otpVerifyLimiter;
}
