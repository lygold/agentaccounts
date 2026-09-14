import "server-only";
import { z } from "zod";

/**
 * Parse `persons[N].field` entries out of FormData into an array of objects.
 * The PersonsForm component writes fields with names like `persons.0.name`,
 * `persons.0.phone`, `persons.1.name`, etc. — this collapses them back.
 *
 * Empty strings collapse to undefined so optional fields don't show up as ""
 * in Monday.
 */
export function parsePersons(
  formData: FormData,
): Array<Record<string, string>> {
  const out: Array<Record<string, string>> = [];
  for (const [key, value] of formData.entries()) {
    const m = /^persons\.(\d+)\.([a-zA-Z]+)$/.exec(key);
    if (!m) continue;
    const idx = Number(m[1]);
    const field = m[2];
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    out[idx] = { ...(out[idx] ?? {}), [field]: trimmed };
  }
  // Drop array holes (e.g. removed person 0 → index 1 only)
  return out.filter(Boolean);
}

export const PersonSchema = z.object({
  name: z.string().trim().min(1),
  teudatZehut: z
    .string()
    .trim()
    .regex(/^\d+$/, "תעודת זהות — ספרות בלבד. עבור זרים/דרכון, ציינו בהערות למשרד")
    .optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().email().optional().or(z.literal("").transform(() => undefined)),
});

export const PartySchema = z.object({
  name: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().email().optional().or(z.literal("").transform(() => undefined)),
});

const CommissionUnitSchema = z.enum(["percentage", "shekel", "months"]);
const ReferralUnitSchema = z.enum(["percentage", "shekel"]);
const VatModeSchema = z.enum(["plus", "included"]);

/** Main commission fields only — validated separately from the referral
 *  sub-object so an incomplete referral (e.g. phone left blank) can be
 *  dropped without losing the agent's already-valid main commission entry.
 *  See owner-commission/buyer-commission actions.ts for how the two are
 *  composed; same "drop the invalid bit, don't fail the whole step" spirit
 *  as parsePersons() above. */
export const MainCommissionSchema = z.object({
  unit: CommissionUnitSchema,
  amount: z.coerce.number(),
  vatMode: VatModeSchema,
});

export const CommissionReferralSchema = z.object({
  agentName: z.string().trim().min(1),
  officeName: z.string().trim().optional(),
  phone: z.string().trim().min(1),
  unit: ReferralUnitSchema,
  amount: z.coerce.number(),
  vatMode: VatModeSchema,
});
