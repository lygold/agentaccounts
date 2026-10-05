import type { PropertyRecord } from "../types";
import {
  ADDITIONAL_FEATURES,
  CONDITIONS,
  NO,
  PROPERTY_TYPES,
  REFERRAL_EXTERNAL_AGENT,
  REFERRAL_NONE,
  REFERRAL_SOURCES,
  YES,
} from "./options";

/**
 * Properties created by the FIRST version of the wizard (before 2026-10-05)
 * stored their own option keys ("apartment", "socialMedia", "renovated") and
 * plain true/false for the yes/no questions. The Monday push needs the board's
 * real labels, so this translates old values on the way out. It is idempotent
 * (a value that is already a valid label is left alone) and drops anything with
 * no equivalent rather than failing the whole push. It does not rewrite the
 * stored record.
 */

const PROPERTY_TYPE: Record<string, string> = {
  apartment: "דירה",
  gardenApartment: "דירת גן",
  penthouse: "גג/ פנטהאוז",
  roofApartment: "גג/ פנטהאוז",
  duplex: "דופלקס",
  house: "בית פרטי/קוטג",
  commercial: "מסחרי",
  office: "מסחרי",
};

/** old referral key -> [Monday referral label, Monday "other source" label?] */
const REFERRAL: Record<string, [string, string?]> = {
  website: [REFERRAL_NONE, "פרסום"],
  socialMedia: [REFERRAL_NONE, "רשתות חברתיות"],
  sign: [REFERRAL_NONE, "פרסום"],
  recommendation: ["המלצת מוכר"],
  existingClient: ["לקוח עבר"],
  externalAgent: [REFERRAL_EXTERNAL_AGENT],
};

const CONDITION: Record<string, string> = {
  new: CONDITIONS[1],
  renovated: CONDITIONS[2],
  good: CONDITIONS[3],
  needsWork: CONDITIONS[4],
};

const asLabel = (v: unknown): string | undefined =>
  typeof v === "boolean" ? (v ? YES : NO) : typeof v === "string" && v !== "" ? v : undefined;

const inList = (list: readonly string[], v: string | undefined): string | undefined =>
  v !== undefined && list.includes(v) ? v : undefined;

export function normalizeLegacyProperty(p: PropertyRecord): PropertyRecord {
  const out: PropertyRecord = { ...p };

  const type = (p.propertyType ?? "") as string;
  out.propertyType = inList(PROPERTY_TYPES, type) ?? PROPERTY_TYPE[type];

  const src = (p.referralSource ?? "") as string;
  if (inList(REFERRAL_SOURCES, src)) {
    out.referralSource = src;
  } else if (REFERRAL[src]) {
    out.referralSource = REFERRAL[src][0];
    if (REFERRAL[src][1] && !p.referralSourceOther) out.referralSourceOther = REFERRAL[src][1];
  } else {
    out.referralSource = undefined;
  }

  const cond = (p.condition ?? "") as string;
  out.condition = inList(CONDITIONS, cond) ?? CONDITION[cond];

  for (const key of ["masterSuite", "elevator", "balcony", "garden", "ac", "parking", "storage", "safeRoom"] as const) {
    (out as unknown as Record<string, unknown>)[key] = asLabel((p as unknown as Record<string, unknown>)[key]);
  }

  if (p.additionalFeatures) {
    const kept = p.additionalFeatures.filter((f) => (ADDITIONAL_FEATURES as readonly string[]).includes(f));
    out.additionalFeatures = kept.length > 0 ? kept : undefined;
  }

  // The old wizard saved an unset starting price as 0.
  if (!p.startingPrice) out.startingPrice = undefined;

  return out;
}
