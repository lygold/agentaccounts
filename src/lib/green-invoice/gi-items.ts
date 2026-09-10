import "server-only";
import type { DealSide } from "../types";

/**
 * Green Invoice item (מק"ט) + line-description template per deal side, for
 * RE/MAX Vision's Morning account (from items-1789046378398.csv, see
 * docs/mem/gi-item-catalog.md). Becomes `office.settings.giItems` in Phase 5c;
 * the English template set is added when the wizard supplies doc language
 * (Phase 8) — the 300 is Hebrew until then.
 */

export interface GiItemSpec {
  /** The catalog מק"ט — GI links the line to the saved item by this string. */
  catalogNum: string;
  /** `{address}` = street, `{city}`, `{price}` = the deal's sale price / rent,
   *  comma-formatted (this is the *property* price shown in the text, NOT the
   *  commission — the commission is the line's `price`). */
  descriptionHe: string;
}

export const GI_CONSULTING_ITEM: Record<DealSide, GiItemSpec> = {
  seller: {
    catalogNum: "מכירת נכס",
    descriptionHe: 'דמי ייעוץ - עבור מכירת נכס ברחוב {address}, {city} במחיר {price} ש"ח',
  },
  buyer: {
    catalogNum: "רכישת נכס",
    descriptionHe: 'דמי ייעוץ - עבור רכישת נכס ברחוב {address}, {city} במחיר {price} ש"ח',
  },
  landlord: {
    catalogNum: "השכרת נכס",
    descriptionHe: 'דמי ייעוץ - עבור השכרת נכס ברחוב {address}, {city} במחיר {price} ש"ח',
  },
  renter: {
    catalogNum: "שכירת נכס",
    descriptionHe: 'דמי ייעוץ - עבור שכירת הנכס ברחוב {address}, {city} במחיר {price} ש"ח',
  },
};

/**
 * Split "רחוב יגאל 23/7, ירושלים" → { street, city }. `Deal` carries one
 * address string until the wizard gives us the fields separately (Phase 8);
 * split on the last comma.
 */
export function splitAddress(propertyAddress: string | undefined): {
  street: string;
  city: string;
} {
  const raw = (propertyAddress ?? "").trim();
  const i = raw.lastIndexOf(",");
  return i === -1
    ? { street: raw, city: "" }
    : { street: raw.slice(0, i).trim(), city: raw.slice(i + 1).trim() };
}

/** The 300's line-item description for a deal side. */
export function consultingLineDescription(
  side: DealSide,
  propertyAddress: string | undefined,
  propertyPrice: number,
): string {
  const { street, city } = splitAddress(propertyAddress);
  return GI_CONSULTING_ITEM[side].descriptionHe
    .replace("{address}", street || "—")
    .replace("{city}", city || "—")
    .replace("{price}", propertyPrice.toLocaleString("en-US"));
}
