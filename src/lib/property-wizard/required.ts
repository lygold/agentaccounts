import type { PropertyWizardStep } from "./steps";
import type { PropertyDraft } from "./draft";
import { NO, REFERRAL_NONE } from "./options";

/**
 * Which questions are mandatory - mirrors the original Superform
 * questionnaire's required (*) markers (checked against the live form
 * 2026-10-05). Conditional rules: choosing "לא" on the referral question
 * makes the follow-up source mandatory; "two descriptions = כן" makes the
 * Yad2 description mandatory.
 *
 * Not asked on purpose (per Levi): starting price - agents only enter the
 * asking price, the starting price is derived from it.
 */
export type RequiredKey =
  | "dealType"
  | "contractType"
  | "city"
  | "neighbourhood"
  | "street"
  | "buildingNumber"
  | "apartmentNumber"
  | "commissionPercent"
  | "commissionVatMode"
  | "propertyType"
  | "referralSource"
  | "referralSourceOther"
  | "ownerName"
  | "ownerPhone"
  | "ownerEmail"
  | "mainPhotos"
  | "additionalPhotos"
  | "forms"
  | "copyrightConfirmed"
  | "renderingsConfirmed"
  | "titleHe"
  | "useSeparateYad2Description"
  | "descriptionHe"
  | "descriptionYad2"
  | "rooms"
  | "bedrooms"
  | "toilets"
  | "masterSuite"
  | "floor"
  | "floorsTotal"
  | "sizeSqm"
  | "askingPrice"
  | "condition"
  | "elevator"
  | "balcony"
  | "ac"
  | "parking"
  | "storage"
  | "safeRoom"
  | "sellabilityRating"
  | "sellerMotivation"
  | "priceToCmaMatch"
  | "ownerPressureToSell"
  | "trueCmaValue"
  | "estimatedMonthsToSell"
  | "letterGrade";

export const REQUIRED_BY_STEP: Record<PropertyWizardStep, RequiredKey[]> = {
  "deal-type": ["dealType"],
  "contract-pick": ["contractType"],
  address: ["city", "neighbourhood", "street", "buildingNumber", "apartmentNumber"],
  commission: ["commissionPercent", "commissionVatMode"],
  details: [
    "propertyType",
    "referralSource",
    "referralSourceOther", // only when referralSource === "לא"
    "ownerName",
    "ownerPhone",
    "ownerEmail",
  ],
  media: ["mainPhotos", "additionalPhotos", "forms", "copyrightConfirmed", "renderingsConfirmed"],
  descriptions: ["titleHe", "useSeparateYad2Description", "descriptionHe", "descriptionYad2"],
  technical: [
    "rooms",
    "bedrooms",
    "toilets",
    "masterSuite",
    "floor",
    "floorsTotal",
    "sizeSqm",
    "askingPrice",
    "condition",
    "elevator",
    "balcony",
    "ac",
    "parking",
    "storage",
    "safeRoom",
  ],
  ratings: [
    "sellabilityRating",
    "sellerMotivation",
    "priceToCmaMatch",
    "ownerPressureToSell",
    "trueCmaValue",
    "estimatedMonthsToSell",
    "letterGrade",
  ],
  review: [],
};

const filled = (v: unknown): boolean =>
  typeof v === "string" ? v.trim().length > 0 : v !== undefined && v !== null && !Number.isNaN(v);

function isMissing(key: RequiredKey, d: Partial<PropertyDraft>): boolean {
  switch (key) {
    case "referralSourceOther":
      return d.referralSource === REFERRAL_NONE && !filled(d.referralSourceOther);
    case "descriptionYad2":
      return d.useSeparateYad2Description === true && !filled(d.descriptionYad2);
    case "mainPhotos":
    case "additionalPhotos":
    case "forms":
      return (d.media?.[key]?.length ?? 0) === 0;
    case "copyrightConfirmed":
    case "renderingsConfirmed":
    case "useSeparateYad2Description":
      return typeof d[key] !== "boolean";
    default:
      return !filled(d[key as keyof PropertyDraft]);
  }
}

/** Missing mandatory answers for one step (empty = step is complete). */
export function missingForStep(step: PropertyWizardStep, d: Partial<PropertyDraft>): RequiredKey[] {
  return REQUIRED_BY_STEP[step].filter((k) => isMissing(k, d));
}

/** Every missing mandatory answer across the whole wizard, with the step that
 *  owns it - the review page's gate and list. */
export function missingAll(d: Partial<PropertyDraft>): Array<{ key: RequiredKey; step: PropertyWizardStep }> {
  const out: Array<{ key: RequiredKey; step: PropertyWizardStep }> = [];
  for (const step of Object.keys(REQUIRED_BY_STEP) as PropertyWizardStep[]) {
    for (const key of missingForStep(step, d)) out.push({ key, step });
  }
  return out;
}

/** "?missing=a,b" suffix for redirecting back to a step. */
export function missingQuery(keys: RequiredKey[]): string {
  return `?missing=${keys.join(",")}`;
}

export { NO };
