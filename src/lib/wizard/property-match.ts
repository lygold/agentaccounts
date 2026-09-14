import type { PropertySummary } from "@/lib/wizard/monday";

/**
 * Find a single unambiguous match for a manually-typed/AI-extracted address
 * among an agent's own listings. Shared between the property step's
 * "did you mean" prompt and the review page's version of the same check —
 * keep both in sync by matching here, not by duplicating the rules.
 *
 * Street matches as a substring (so a real listing suggests itself before
 * the agent's finished typing); building number matches as a prefix once
 * typed, but only narrows when it doesn't wipe out every candidate. More
 * than one surviving candidate is still ambiguous, so no match is returned.
 */
export function findMatchingProperty(
  properties: PropertySummary[],
  street: string | null | undefined,
  buildingNumber: string | null | undefined,
): PropertySummary | null {
  const s = street?.trim().toLowerCase() ?? "";
  if (s.length < 2) return null;
  const building = buildingNumber?.trim() ?? "";

  let candidates = properties.filter((p) =>
    p.street?.trim().toLowerCase().includes(s),
  );

  if (building) {
    const narrowed = candidates.filter((p) =>
      p.buildingNumber?.trim().startsWith(building),
    );
    if (narrowed.length > 0) candidates = narrowed;
  }

  if (candidates.length !== 1) return null;
  return candidates[0];
}
