import "server-only";

/**
 * Phase 9 — Places API (New), server-side only. The property wizard's
 * address step calls this via src/lib/places-actions.ts (a server action)
 * rather than loading Google's JS library in the browser, so
 * GOOGLE_MAPS_API_KEY never reaches client code — see ROADMAP.md / the
 * chat for the cost/security reasoning.
 *
 * Field mask is deliberately restricted to the Essentials-tier fields
 * (id, formattedAddress, addressComponents, location) — anything beyond
 * that (displayName, businessStatus, ratings, etc.) bills at the pricier
 * Pro/Enterprise SKU tiers and this wizard has no use for it. Keep it
 * that way if this file is ever extended.
 */

const AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";
const DETAILS_URL = "https://places.googleapis.com/v1/places";
const ESSENTIALS_FIELD_MASK = "id,formattedAddress,addressComponents,location";

function getApiKey(): string {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) throw new Error("GOOGLE_MAPS_API_KEY is not set");
  return key;
}

export interface AddressSuggestion {
  placeId: string;
  mainText: string;
  secondaryText: string;
}

type AutocompleteResponse = {
  suggestions?: Array<{
    placePrediction?: {
      placeId: string;
      structuredFormat?: {
        mainText?: { text: string };
        secondaryText?: { text: string };
      };
      text?: { text: string };
    };
  }>;
};

/** Keystroke-by-keystroke suggestions — free under Places' session pricing
 *  as long as `sessionToken` is the same value for the whole autocomplete
 *  interaction and it's eventually terminated by getPlaceAddressDetails. */
export async function autocompleteAddress(
  input: string,
  sessionToken: string,
): Promise<AddressSuggestion[]> {
  if (!input.trim()) return [];

  const res = await fetch(AUTOCOMPLETE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": getApiKey(),
    },
    body: JSON.stringify({
      input,
      sessionToken,
      // Israel-biased, Hebrew-first — this office's whole addressable area.
      includedRegionCodes: ["il"],
      languageCode: "he",
      // Bias (not restrict) toward Jerusalem - this office's home turf - so a bare
      // "דרך חברון 54" resolves to the Jerusalem one first.
      locationBias: { circle: { center: { latitude: 31.7683, longitude: 35.2137 }, radius: 50000 } },
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Places autocomplete failed (${res.status}): ${await res.text()}`);
  }
  const body = (await res.json()) as AutocompleteResponse;
  return (body.suggestions ?? [])
    .map((s) => s.placePrediction)
    .filter((p): p is NonNullable<typeof p> => !!p)
    .map((p) => ({
      placeId: p.placeId,
      mainText: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
      secondaryText: p.structuredFormat?.secondaryText?.text ?? "",
    }));
}

export interface PlaceAddressDetails {
  placeId: string;
  formattedAddress: string;
  lat: number | null;
  lng: number | null;
  city?: string;
  street?: string;
  buildingNumber?: string;
  neighbourhood?: string;
}

type AddressComponent = { types: string[]; longText?: string; shortText?: string };

function componentText(components: AddressComponent[], type: string): string | undefined {
  return components.find((c) => c.types.includes(type))?.longText;
}

/** The terminating call in a session — this is the one billed request
 *  (Place Details Essentials, free under 10k/month). Pass the SAME
 *  sessionToken used for the autocompleteAddress calls that led here. */
export async function getPlaceAddressDetails(
  placeId: string,
  sessionToken: string,
): Promise<PlaceAddressDetails> {
  const url =
    `${DETAILS_URL}/${encodeURIComponent(placeId)}` +
    `?sessionToken=${encodeURIComponent(sessionToken)}&languageCode=he`;
  const res = await fetch(url, {
    headers: {
      "X-Goog-Api-Key": getApiKey(),
      "X-Goog-FieldMask": ESSENTIALS_FIELD_MASK,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Places details failed (${res.status}): ${await res.text()}`);
  }
  const body = (await res.json()) as {
    id: string;
    formattedAddress?: string;
    location?: { latitude: number; longitude: number };
    addressComponents?: AddressComponent[];
  };
  const components = body.addressComponents ?? [];
  return {
    placeId: body.id,
    formattedAddress: body.formattedAddress ?? "",
    lat: body.location?.latitude ?? null,
    lng: body.location?.longitude ?? null,
    // Israeli addresses come back as "route" (street) + "street_number"
    // (building number) + "locality" (city) component types.
    city: componentText(components, "locality"),
    street: componentText(components, "route"),
    buildingNumber: componentText(components, "street_number"),
    // Not every Israeli address carries one; when Google has it, prefill - the
    // agent can always edit or fill it in (it is a required question).
    neighbourhood:
      componentText(components, "neighborhood") ?? componentText(components, "sublocality_level_1"),
  };
}

/** Spelling-insensitive comparison key: Hebrew punctuation variants, spacing, case. */
export function addressKey(s: string | undefined): string {
  return (s ?? "")
    .normalize("NFC")
    .replace(/[׳’‘`´]/g, "'")
    .replace(/[״“”]/g, '"')
    .replace(/[־–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export interface AddressVerification {
  /** verified = Google resolved it and the street, building number AND city all
   *  match what the agent typed; suggest = Google resolved something for the
   *  agent to confirm (a different spelling/number, or - always - an address
   *  that came without a city, since Google's pick of city is a guess);
   *  none = Google found no street address. */
  status: "verified" | "suggest" | "none";
  details?: PlaceAddressDetails;
}

/** The office's home city: a bare street + number is looked up here first. */
export const DEFAULT_CITY = "ירושלים";

function stripStreetPrefix(s: string): string {
  return addressKey(s).replace(/^(רחוב|רח'|רח)\s+/, "");
}

function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length][b.length];
}

/** 0..1 - how alike two street names are, ignoring a leading "רחוב". */
export function streetSimilarity(a: string | undefined, b: string | undefined): number {
  const x = stripStreetPrefix(a ?? "");
  const y = stripStreetPrefix(b ?? "");
  if (!x || !y) return 0;
  return 1 - editDistance(x, y) / Math.max(x.length, y.length);
}

/** Below this, Google's street is a different street, not a spelling fix. */
const MIN_STREET_SIMILARITY = 0.6;

async function lookupOne(query: string): Promise<PlaceAddressDetails | null> {
  const sessionToken = crypto.randomUUID();
  const suggestions = await autocompleteAddress(query, sessionToken);
  if (suggestions.length === 0) return null;
  const details = await getPlaceAddressDetails(suggestions[0].placeId, sessionToken);
  return details.street ? details : null;
}

/**
 * Checks a free-text address (a signed contract's "דרך חברון 54", or what an
 * agent typed) against Google and returns Google's canonical version - the
 * spelling, city, neighbourhood and place id. Each lookup is one autocomplete +
 * one details call under a single session token (Essentials tier).
 *
 * Street names repeat across Israel ("דרך חברון 54" exists in Be'er Sheva too),
 * so with no city given the lookup is made in Jerusalem first, then nationwide,
 * and the result is never "verified" - the agent confirms the city Google chose.
 * A result whose street isn't similar to the one given is discarded (Google
 * will happily fuzzy-match nonsense to something). If Google knows the street
 * but not that building number, its street/city are returned without a number
 * and the caller keeps the agent's.
 */
export async function verifyAddressText(
  text: string,
  expected: { street?: string; buildingNumber?: string; city?: string } = {},
): Promise<AddressVerification> {
  const input = text.trim();
  if (!input) return { status: "none" };
  const cityGiven = !!expected.city?.trim();
  const homeCity = cityGiven ? expected.city!.trim() : DEFAULT_CITY;
  const inHome = addressKey(input).includes(addressKey(homeCity)) ? input : `${input} ${homeCity}`;
  const queries = cityGiven ? [inHome] : [inHome, input];

  try {
    for (const query of queries) {
      const details = await lookupOne(query);
      if (!details) continue;
      if (expected.street && streetSimilarity(details.street, expected.street) < MIN_STREET_SIMILARITY) continue;
      // The agent stated the city: a hit in another city is a different place, not a
      // spelling correction - never offer it as a replacement.
      if (cityGiven && addressKey(details.city) !== addressKey(expected.city)) continue;

      const sameStreet = !expected.street || stripStreetPrefix(details.street!) === stripStreetPrefix(expected.street);
      const sameNumber =
        !expected.buildingNumber || addressKey(details.buildingNumber) === addressKey(expected.buildingNumber);
      const sameCity = cityGiven && addressKey(details.city) === addressKey(expected.city);
      return { status: sameStreet && sameNumber && sameCity ? "verified" : "suggest", details };
    }
    return { status: "none" };
  } catch (err) {
    console.error("verifyAddressText failed", err);
    return { status: "none" };
  }
}
