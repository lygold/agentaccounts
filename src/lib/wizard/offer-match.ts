import type { ClientSummary, OfferSummary } from "@/lib/wizard/monday";

/**
 * Fuzzy-match items with a single free-text address field against a deal's
 * street/building — plain substring match on the street name, narrowed by
 * building number when that also appears in the text (only when it doesn't
 * wipe out every candidate — still-typing shouldn't erase a good match).
 * Returns every match, not just a single unambiguous one, since this feeds
 * a "here are some buyers" suggestion list rather than a single confirm
 * prompt like the property picker's "did you mean".
 */
function fuzzyMatchByAddressText<T>(
  items: T[],
  getAddressText: (item: T) => string | null,
  street: string | null | undefined,
  buildingNumber: string | null | undefined,
): T[] {
  const s = street?.trim().toLowerCase();
  if (!s || s.length < 2) return [];

  let candidates = items.filter((item) =>
    getAddressText(item)?.toLowerCase().includes(s),
  );

  const building = buildingNumber?.trim();
  if (building) {
    const narrowed = candidates.filter((item) =>
      getAddressText(item)?.includes(building),
    );
    if (narrowed.length > 0) candidates = narrowed;
  }

  return candidates;
}

/** Offers board — text_mkrv1z03 has no link to Properties Raw Data. */
export function findMatchingOffers(
  offers: OfferSummary[],
  street: string | null | undefined,
  buildingNumber: string | null | undefined,
): OfferSummary[] {
  return fuzzyMatchByAddressText(
    offers,
    (o) => o.propertyAddressText,
    street,
    buildingNumber,
  );
}

/** Signed Contracts board — property_address is also free text there. */
export function findMatchingClientsByProperty(
  clients: ClientSummary[],
  street: string | null | undefined,
  buildingNumber: string | null | undefined,
): ClientSummary[] {
  return fuzzyMatchByAddressText(
    clients,
    (c) => c.propertyAddress,
    street,
    buildingNumber,
  );
}
