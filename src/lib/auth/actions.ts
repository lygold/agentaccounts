"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { findAgentByContact } from "../store/agents";
import { canonicalizeContact } from "../phone";
import { isBootstrapAdmin } from "./roles";
import { sendOtpEmail } from "../email/make-webhook";
import { sendOtpTemplate, toMetaPhone } from "../waba/client";
import {
  generateOtp,
  isContactLocked,
  lockContact,
  recordBadAttempt,
  storeOtp,
  verifyOtp as verifyOtpStore,
} from "./otp";
import { otpSendLimiter, otpVerifyLimiter } from "./rate-limit";
import { logAudit } from "./audit";
import { setSessionCookie } from "./session-cookie";
import { isNextJsRedirect } from "../action-utils";

const MAX_BAD_ATTEMPTS = 5;

export interface AuthActionResult {
  ok: boolean;
  message?: string;
}

async function getClientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "unknown"
  );
}

const ContactSchema = z.object({
  contact: z.string().trim().min(1, "Enter a phone number or email.").max(120),
});

const OtpSchema = z.object({
  contact: z.string().trim().min(1),
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code."),
});

/**
 * Page 1 → page 2. Looks up the agent on Daf Kesher, sends an OTP.
 *
 * DEV_OTP_BYPASS_CODE (non-production only): when set, skips the actual
 * WhatsApp/email send entirely and logs the real code to the console
 * instead — lets you smoke-test the whole login flow before WABA/Make
 * credentials are wired up. TODO before any real deployment: gate this on
 * request hostname too, not just NODE_ENV, same reasoning as sikkumPigisha's
 * own DEV_OTP_BYPASS_CODE comment (Amplify branch previews are still
 * `next build` production builds).
 */
export async function requestOtp(
  _prev: AuthActionResult | null,
  formData: FormData,
): Promise<AuthActionResult> {
  const parsed = ContactSchema.safeParse({ contact: formData.get("contact") });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const contactInput = parsed.data.contact;
  const key = canonicalizeContact(contactInput);
  const ip = await getClientIp();

  if (await isContactLocked(key)) {
    await logAudit({ kind: "otp_locked", contact: key, ip });
    return { ok: false, message: "Too many attempts — locked for an hour." };
  }

  const { success: underLimit } = await otpSendLimiter().limit(key);
  if (!underLimit) {
    return { ok: false, message: "Too many codes sent — try again shortly." };
  }

  const agent = await findAgentByContact(contactInput);
  await logAudit({ kind: "otp_request", contact: key, matched: !!agent, ip });

  if (!agent) {
    return { ok: false, message: "We don't recognize that phone number or email." };
  }

  const otp = generateOtp();
  await storeOtp(key, otp);

  const devBypass = process.env.NODE_ENV !== "production" && process.env.DEV_OTP_BYPASS_CODE;
  if (devBypass) {
    console.warn(`[dev] OTP for ${key}: ${otp} (or use DEV_OTP_BYPASS_CODE)`);
  } else {
    const deliveryMethod = (formData.get("deliveryMethod") as string) || "whatsapp";
    const useWhatsApp = deliveryMethod === "whatsapp" && !!agent.phone;

    try {
      if (useWhatsApp) {
        await sendOtpTemplate(toMetaPhone(agent.phone!), otp);
      } else if (agent.email) {
        await sendOtpEmail({ email: agent.email, code: otp, ttlMinutes: 10 });
      } else {
        return { ok: false, message: "No email on file to send a code to." };
      }
    } catch (err) {
      console.error("OTP send failed, trying email fallback", err);
      if (!agent.email) return { ok: false, message: "Couldn't send a code." };
      try {
        await sendOtpEmail({ email: agent.email, code: otp, ttlMinutes: 10 });
      } catch (err2) {
        console.error("Fallback email OTP send also failed", err2);
        return { ok: false, message: "Couldn't send a code." };
      }
    }
  }

  redirect(`/login/otp?c=${encodeURIComponent(key)}`);
}

/** Page 2. Verifies the OTP, mints a role-carrying session, redirects in. */
export async function verifyOtp(
  _prev: AuthActionResult | null,
  formData: FormData,
): Promise<AuthActionResult> {
  const parsed = OtpSchema.safeParse({
    contact: formData.get("contact"),
    code: formData.get("code"),
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { contact, code } = parsed.data;
  const key = canonicalizeContact(contact);
  const ip = await getClientIp();

  try {
    if (await isContactLocked(key)) {
      return { ok: false, message: "Locked — try again later." };
    }

    const { success: underLimit } = await otpVerifyLimiter().limit(key);
    if (!underLimit) {
      return { ok: false, message: "Too many attempts." };
    }

    const devBypass =
      process.env.NODE_ENV !== "production" &&
      !!process.env.DEV_OTP_BYPASS_CODE &&
      code === process.env.DEV_OTP_BYPASS_CODE;

    const ok = devBypass || (await verifyOtpStore(key, code));
    if (!ok) {
      const attempt = await recordBadAttempt(key);
      if (attempt >= MAX_BAD_ATTEMPTS) {
        await lockContact(key);
        await logAudit({ kind: "otp_locked", contact: key, ip });
        return { ok: false, message: "Too many wrong codes — locked for an hour." };
      }
      await logAudit({ kind: "otp_verify_fail", contact: key, attempt, ip });
      return {
        ok: false,
        message: `Wrong code — ${MAX_BAD_ATTEMPTS - attempt} attempts left.`,
      };
    }

    const agent = await findAgentByContact(contact);
    if (!agent) {
      return { ok: false, message: "Account not found." };
    }

    // The stored role is authoritative; the bootstrap allowlist can still
    // promote to admin so Levi can't be locked out (see roles.ts).
    const role = isBootstrapAdmin(contact) ? "admin" : agent.role;

    await setSessionCookie({
      officeId: agent.officeId,
      agentId: agent.id,
      agentName: agent.name,
      agentEmail: agent.email,
      agentPhone: agent.phone,
      role,
      team: agent.team,
    });

    await logAudit({ kind: "otp_verify_ok", agentId: agent.id, role, ip });
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("verifyOtp failed:", e);
    return { ok: false, message: "Something went wrong. Try again." };
  }

  redirect("/");
}
