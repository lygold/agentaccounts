"use server";

import { requireSession } from "@/lib/auth/session-cookie";
import {
  autocompleteAddress,
  getPlaceAddressDetails,
  verifyAddressText,
  type AddressSuggestion,
  type AddressVerification,
  type PlaceAddressDetails,
} from "./places";

/**
 * RPC-style server actions (called directly from client JS as the agent
 * types, not a <form> submit) backing src/components/address-autocomplete.tsx.
 * Session-gated like every other wizard read — this app has no anonymous
 * pages — but otherwise thin passthroughs to places.ts; see that file for
 * the actual Places API (New) calls and the Essentials-tier field mask.
 */

export async function searchAddress(
  input: string,
  sessionToken: string,
): Promise<AddressSuggestion[]> {
  await requireSession();
  try {
    return await autocompleteAddress(input, sessionToken);
  } catch (err) {
    // Surface as "no suggestions" rather than crashing the input while the
    // agent types — a transient Places error shouldn't block manual entry.
    console.error("searchAddress failed", err);
    return [];
  }
}

export async function resolveAddress(
  placeId: string,
  sessionToken: string,
): Promise<PlaceAddressDetails | null> {
  await requireSession();
  try {
    return await getPlaceAddressDetails(placeId, sessionToken);
  } catch (err) {
    console.error("resolveAddress failed", err);
    return null;
  }
}

/** "Check with Google": verify the street/building/city the agent typed. */
export async function verifyTypedAddress(fields: {
  city?: string;
  street?: string;
  buildingNumber?: string;
}): Promise<AddressVerification> {
  await requireSession();
  const text = [fields.street, fields.buildingNumber, fields.city].filter(Boolean).join(" ");
  return verifyAddressText(text, { street: fields.street, buildingNumber: fields.buildingNumber });
}
