import "server-only";
import { createHash } from "node:crypto";
import { getRedis, RedisKeys } from "../redis";
import { listAgentsByOffice } from "../store/agents";
import { sendNotificationEmail } from "../email/notification-webhook";
import { APP_BASE_URL } from "../office";
import type { PropertyRecord } from "../types";

/**
 * Admin-only alerts for the Monday push. Agents never see Monday (and Monday is
 * being retired), so a failed push is surfaced to admins only:
 *   - a current-failures hash in Redis (one entry per property, cleared on a
 *     successful retry) that drives the admin nav badge and /admin/monday-sync;
 *   - an email to every admin (admin-role agents + BOOTSTRAP_ADMIN_EMAIL), once
 *     per distinct failure, when MAKE_NOTIFICATION_WEBHOOK_URL is configured.
 * WhatsApp is not used: business-initiated WhatsApp needs a pre-approved
 * template, and there is none for system alerts.
 */

export interface MondaySyncAlert {
  propertyId: string;
  label: string;
  agentName: string;
  error: string;
  /** The item was created on Monday with core fields only. */
  partial: boolean;
  at: string;
  emailed: boolean;
}

const DEDUPE_SECONDS = 6 * 60 * 60;

function label(p: PropertyRecord): string {
  return [p.street, p.buildingNumber, p.apartmentNumber ? `דירה ${p.apartmentNumber}` : undefined]
    .filter(Boolean)
    .join(" ") || p.id;
}

/** Admin-role agents with an email, plus the break-glass admin. */
export async function adminEmails(officeId: string): Promise<string[]> {
  const out = new Set<string>();
  try {
    for (const a of await listAgentsByOffice(officeId, { includeArchived: false })) {
      const email = (a as { email?: string; role?: string }).email;
      if ((a as { role?: string }).role === "admin" && email) out.add(email.toLowerCase());
    }
  } catch (e) {
    console.error("[admin-alerts] could not list admin agents:", e);
  }
  if (process.env.BOOTSTRAP_ADMIN_EMAIL) out.add(process.env.BOOTSTRAP_ADMIN_EMAIL.toLowerCase());
  return [...out];
}

/** Record (and, once per distinct failure, email) a failed/partial Monday push. */
export async function raiseMondaySyncAlert(
  property: PropertyRecord,
  error: string,
  partial: boolean,
): Promise<void> {
  let emailed = false;
  try {
    const redis = getRedis();
    const fresh = await redis.set(
      `al:alert:monday:${property.id}:${createHash("sha1").update(error).digest("hex").slice(0, 12)}`,
      "1",
      { nx: true, ex: DEDUPE_SECONDS },
    );

    if (fresh && process.env.MAKE_NOTIFICATION_WEBHOOK_URL) {
      const recipients = await adminEmails(property.officeId);
      const subject = `Monday sync ${partial ? "partially failed" : "failed"}: ${label(property)}`;
      const body =
        `Property: ${label(property)}\nAgent: ${property.agentName}\n` +
        `${partial ? "The Monday item was created with core fields only.\n" : "Nothing was created on Monday.\n"}` +
        `Error: ${error}\n\nReview and retry: ${APP_BASE_URL}/admin/monday-sync`;
      for (const to of recipients) {
        try {
          await sendNotificationEmail({ to, subject, body });
          emailed = true;
        } catch (e) {
          console.error("[admin-alerts] email failed:", e);
        }
      }
    } else if (fresh) {
      console.warn("[admin-alerts] MAKE_NOTIFICATION_WEBHOOK_URL is not set - no email sent");
    }

    const entry: MondaySyncAlert = {
      propertyId: property.id,
      label: label(property),
      agentName: property.agentName,
      error,
      partial,
      at: new Date().toISOString(),
      emailed,
    };
    await redis.hset(RedisKeys.mondaySyncFailures, { [property.id]: JSON.stringify(entry) });
  } catch (e) {
    console.error("[admin-alerts] could not record alert:", e);
  }
}

export async function clearMondaySyncAlert(propertyId: string): Promise<void> {
  try {
    await getRedis().hdel(RedisKeys.mondaySyncFailures, propertyId);
  } catch (e) {
    console.error("[admin-alerts] could not clear alert:", e);
  }
}

export async function listMondaySyncAlerts(): Promise<MondaySyncAlert[]> {
  try {
    const all = await getRedis().hgetall<Record<string, unknown>>(RedisKeys.mondaySyncFailures);
    if (!all) return [];
    return Object.values(all)
      .map((v) => (typeof v === "string" ? (JSON.parse(v) as MondaySyncAlert) : (v as MondaySyncAlert)))
      .filter((v) => v && typeof v === "object" && "propertyId" in v)
      .sort((a, b) => b.at.localeCompare(a.at));
  } catch {
    return [];
  }
}

/** Cheap count for the admin nav badge. */
export async function mondaySyncAlertCount(): Promise<number> {
  try {
    return await getRedis().hlen(RedisKeys.mondaySyncFailures);
  } catch {
    return 0;
  }
}
