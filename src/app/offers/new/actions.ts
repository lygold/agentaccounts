"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session-cookie";
import { getProperty } from "@/lib/store/properties";
import { createOffer } from "@/lib/store/offers";
import { isNextJsRedirect } from "@/lib/action-utils";
import type { DocLanguage } from "@/lib/types";

/**
 * Creates the offer request + its shareable buyer token. SECURITY: the
 * property list the picker shows was already scoped client-side, but this
 * re-fetches and re-checks ownership server-side anyway — never trust a
 * posted propertyId (same defense-in-depth principle as the deal wizard's
 * property step, src/app/deals/new/(wizard)/property/actions.ts).
 */
export async function createOfferRequest(formData: FormData) {
  try {
    const session = await requireSession();

    const propertyId = formData.get("propertyId");
    const propertyAddress = formData.get("propertyAddress");
    const ownerName = formData.get("ownerName");
    const language = formData.get("language");
    const withLogo = formData.get("withLogo") === "true";

    if (
      typeof propertyId !== "string" ||
      typeof propertyAddress !== "string" ||
      !propertyAddress.trim() ||
      typeof ownerName !== "string" ||
      !ownerName.trim() ||
      (language !== "hebrew" && language !== "english")
    ) {
      redirect("/offers/new?error=invalid");
    }

    // Empty propertyId = "my property doesn't appear" — a free-standing
    // offer, not linked to any PropertyRecord. Only re-check ownership when
    // one was actually picked from the (already server-scoped) picker.
    if (propertyId) {
      const property = await getProperty(propertyId);
      if (!property || property.officeId !== session.officeId || property.agentId !== session.agentId) {
        redirect("/offers/new?error=forbidden");
      }
    }

    const offer = await createOffer({
      officeId: session.officeId,
      agentId: session.agentId,
      agentName: session.agentName,
      propertyId: propertyId || null,
      propertyAddress: propertyAddress.trim(),
      ownerName: ownerName.trim(),
      language: language as DocLanguage,
      withLogo,
      token: randomUUID(),
      tokenCreatedAt: new Date().toISOString(),
    });

    redirect(`/offers/${offer.id}`);
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("createOfferRequest failed:", e);
    redirect("/offers/new?error=save");
  }
}
