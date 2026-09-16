import "server-only";
import { randomUUID } from "node:crypto";
import { getRedis, RedisKeys } from "../redis";
import { updateProperty } from "../store/properties";
import { sendNotificationEmail } from "../email/notification-webhook";
import { sendPropertyUpdateTemplate, toMetaPhone } from "../waba/client";
import type { PropertyRecord, PropertyUpdateEntry } from "../types";

/**
 * Property-edit → secretary notification, per Levi's confirmed workflow:
 * any field an agent changes fires this — the edit itself already saved
 * (no approval gate), this just tells the secretary to go update the
 * ~8 external sites. Two independent kill switches
 * (PROPERTY_NOTIFY_EMAIL_ENABLED / PROPERTY_NOTIFY_WHATSAPP_ENABLED,
 * default on) — "I reserve the right to turn off certain notification
 * channels". Never throws — a failed channel is logged and recorded as
 * not-sent on the update entry, never blocks the edit itself.
 */

/** Field labels for the change summary — covers the edit page's actual
 *  editable fields; anything else falls back to its raw key name. */
const FIELD_LABELS: Partial<Record<keyof PropertyRecord, string>> = {
  status: "סטטוס",
  city: "עיר",
  street: "רחוב",
  buildingNumber: "מספר בית",
  apartmentNumber: "מספר דירה",
  entrance: "כניסה",
  ownerName: "שם בעלים",
  ownerPhone: "טלפון בעלים",
  ownerEmail: "אימייל בעלים",
  commissionPercent: "אחוז עמלה",
  commissionVatMode: "מע\"מ",
  exclusivityStartDate: "תחילת בלעדיות",
  exclusivityEndDate: "סיום בלעדיות",
  propertyType: "סוג נכס",
  referralSource: "מקור הפניה",
  titleHe: "כותרת",
  descriptionHe: "תיאור",
  descriptionEn: "תיאור באנגלית",
  rooms: "חדרים",
  sizeSqm: "שטח",
  askingPrice: "מחיר מבוקש",
  startingPrice: "מחיר התחלה",
  condition: "מצב הנכס",
  floor: "קומה",
};

function formatValue(v: unknown): string {
  if (v === undefined || v === null || v === "") return "—";
  if (typeof v === "boolean") return v ? "כן" : "לא";
  return String(v);
}

/** Diffs a patch against the property's current values, returning one
 *  readable line per actually-changed field. Fields in the patch whose
 *  value is unchanged (or undefined — "not touched", not "cleared") are
 *  skipped. */
export function summarizeChanges(
  before: PropertyRecord,
  patch: Partial<PropertyRecord>,
): string[] {
  const lines: string[] = [];
  for (const key of Object.keys(patch) as Array<keyof PropertyRecord>) {
    const newVal = patch[key];
    if (newVal === undefined) continue;
    const oldVal = before[key];
    if (newVal === oldVal) continue;
    const label = FIELD_LABELS[key] ?? String(key);
    lines.push(`${label}: ${formatValue(oldVal)} ← ${formatValue(newVal)}`);
  }
  return lines;
}

function propertyLabel(p: PropertyRecord): string {
  return (
    [p.street, p.buildingNumber, p.apartmentNumber ? `דירה ${p.apartmentNumber}` : null]
      .filter(Boolean)
      .join(" ") || "נכס"
  );
}

function emailEnabled(): boolean {
  return process.env.PROPERTY_NOTIFY_EMAIL_ENABLED !== "false";
}
function whatsappEnabled(): boolean {
  return process.env.PROPERTY_NOTIFY_WHATSAPP_ENABLED !== "false";
}

export interface NotifyAuthor {
  id: string;
  name: string;
}

/** Records the change (per-property history + secretary's aggregated
 *  feed) and dispatches whatever channels are enabled and configured.
 *  A no-op if `changes` is empty (nothing actually changed). */
export async function notifyPropertyUpdated(
  property: PropertyRecord,
  changes: string[],
  author: NotifyAuthor,
): Promise<void> {
  if (changes.length === 0) return;
  const address = propertyLabel(property);

  let emailSent = false;
  if (emailEnabled()) {
    const to = process.env.SECRETARY_EMAIL;
    if (to) {
      try {
        await sendNotificationEmail({
          to,
          subject: `עדכון נכס: ${address}`,
          body: `${author.name} עדכן/ה את הנכס ${address}:\n\n${changes.join("\n")}`,
        });
        emailSent = true;
      } catch (e) {
        console.error("[property-notify] email failed:", e);
      }
    } else {
      console.info("[property-notify] SECRETARY_EMAIL not set — skipping email");
    }
  }

  let whatsappSent = false;
  if (whatsappEnabled()) {
    const phone = process.env.SECRETARY_PHONE;
    if (phone) {
      try {
        await sendPropertyUpdateTemplate(toMetaPhone(phone), `${address}: ${changes.join("; ")}`);
        whatsappSent = true;
      } catch (e) {
        console.error("[property-notify] whatsapp failed:", e);
      }
    } else {
      console.info("[property-notify] SECRETARY_PHONE not set — skipping whatsapp");
    }
  }

  const entry: PropertyUpdateEntry = {
    id: randomUUID(),
    at: new Date().toISOString(),
    authorId: author.id,
    authorName: author.name,
    changes,
    channelsSent: { email: emailSent, whatsapp: whatsappSent },
  };

  await updateProperty(
    property.id,
    { updates: [...(property.updates ?? []), entry] },
    property.officeId,
  );

  try {
    const redis = getRedis();
    await redis.lpush(
      RedisKeys.secretaryNotifications,
      JSON.stringify({ propertyId: property.id, propertyLabel: address, ...entry }),
    );
    await redis.ltrim(RedisKeys.secretaryNotifications, 0, 199);
  } catch (e) {
    console.error("[property-notify] could not push to secretary feed:", e);
  }
}
