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
  };
}
