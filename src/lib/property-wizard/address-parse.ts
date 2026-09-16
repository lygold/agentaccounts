/**
 * Splits a raw "{street} {building number}" string — as it comes out of
 * Monday's free-text propertyAddress column on a signed contract, e.g.
 * "דרך חברון 54" — into its street and building-number parts, so the
 * contract-pick step can prefill both fields immediately instead of
 * leaving buildingNumber empty until the agent re-picks the address via
 * Places (the raw text is still seeded into the Places search box too,
 * for the agent to confirm/normalize the street spelling).
 *
 * Deliberately simple: matches a trailing run of digits (optionally with
 * one trailing Hebrew letter, e.g. "54א" for a lettered building) as the
 * building number, everything before it as the street. Addresses that
 * don't match this shape (no trailing number) come back with the whole
 * string as `street` and no `buildingNumber` — never guessed at.
 */
export function parseStreetAndBuilding(raw: string): {
  street?: string;
  buildingNumber?: string;
} {
  const trimmed = raw.trim();
  if (!trimmed) return {};
  const match = /^(.*?)\s+(\d+[א-ת]?)$/.exec(trimmed);
  if (!match) return { street: trimmed };
  const [, street, buildingNumber] = match;
  return { street: street.trim(), buildingNumber };
}
