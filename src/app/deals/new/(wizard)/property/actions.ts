"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session-cookie";
import { getAgentById } from "@/lib/store/agents";
import {
  advanceDraft,
  loadDraft,
  type PartyInput,
  type PersonInput,
  type PropertyInput,
} from "@/lib/wizard/draft";
import { getPropertyForAgent, listSellersForAgent } from "@/lib/wizard/monday";
import { findMatchingClientsByProperty } from "@/lib/wizard/offer-match";
import { destinationStep, stepHref, WIZARD_DESTINATION_FIELD } from "@/lib/wizard/steps";
import { isNextJsRedirect } from "@/lib/wizard/action-utils";

const PickerSchema = z.object({
  mode: z.literal("picker"),
  selectedItemId: z.string().min(1, "בחרו נכס"),
});

const ManualSchema = z.object({
  mode: z.literal("manual"),
  neighbourhood: z.string().trim().optional(),
  street: z.string().trim().optional(),
  buildingNumber: z.string().trim().optional(),
  apartmentNumber: z.string().trim().optional(),
  gushChelka: z.string().trim().optional(),
  rooms: z.coerce.number().int().positive().optional().or(z.literal("")),
  sizeSqm: z.coerce.number().int().positive().optional().or(z.literal("")),
});

const Schema = z.discriminatedUnion("mode", [PickerSchema, ManualSchema]);

export async function submitProperty(formData: FormData) {
  try {
  const session = await requireSession();
  const parsed = Schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return;

  let propertyPatch: PropertyInput;
  let pricePrefill: number | null = null;
  let paymentTermsPrefill: string | null = null;
  let ownerPrefill: PersonInput | null = null;
  let ownerLawyerPrefill: PartyInput | null = null;
  let teudatZehutFromSignedContracts = false;

  // Board ownership on Properties/Signed Contracts is a Monday board_relation
  // to the (Monday) agents board — every ownership check below needs this
  // agent's Monday pulse id, not agentLedger's own agt_<uuid>.
  const agent = await getAgentById(session.agentId);
  const mondayAgentId = agent?.mondayItemId;

  if (parsed.data.mode === "picker") {
    if (!mondayAgentId) {
      redirect(stepHref("property") + "?error=save");
    }
    // SECURITY: server re-verifies the property belongs to this agent before
    // pulling its data. listPropertiesForAgent already filtered, but the
    // client could POST any itemId — we never trust it.
    const property = await getPropertyForAgent(
      parsed.data.selectedItemId,
      mondayAgentId,
    );
    propertyPatch = {
      selectedItemId: property.id,
      neighbourhood: property.neighbourhood ?? undefined,
      street: property.street ?? undefined,
      buildingNumber: property.buildingNumber ?? undefined,
      apartmentNumber: property.apartmentNumber ?? undefined,
      gushChelka: property.gushChelka ?? undefined,
      rooms: property.rooms ?? undefined,
      sizeSqm: property.sizeSqm ?? undefined,
    };
    pricePrefill = property.price;
    paymentTermsPrefill = property.paymentTerms;
    if (property.owner.name) {
      ownerPrefill = {
        name: property.owner.name,
        teudatZehut: property.owner.teudatZehut ?? undefined,
        phone: property.owner.phone ?? undefined,
        email: property.owner.email ?? undefined,
      };
      // Properties board has no teudat-zehut column for the owner at all —
      // it's always null from getPropertyForAgent(). Silently backfill it
      // (and phone/email only if the Properties board didn't have them
      // either) from a matching Signed Contracts seller/landlord record for
      // this address. Only applied when exactly one match — an ambiguous
      // match isn't safe to auto-fill into a required field.
      if (!ownerPrefill.teudatZehut && property.dealType && mondayAgentId) {
        try {
          const sellers = await listSellersForAgent(mondayAgentId, {
            dealType: property.dealType,
          });
          const matches = findMatchingClientsByProperty(
            sellers,
            property.street,
            property.buildingNumber,
          );
          if (matches.length === 1 && matches[0].idNumber) {
            ownerPrefill.teudatZehut = matches[0].idNumber;
            ownerPrefill.phone = ownerPrefill.phone ?? matches[0].phone ?? undefined;
            ownerPrefill.email = ownerPrefill.email ?? matches[0].email ?? undefined;
            teudatZehutFromSignedContracts = true;
          }
        } catch {
          // Non-fatal — owner form just shows an empty teudat-zehut field,
          // same as before this enrichment existed.
        }
      }
    }
    if (property.ownerLawyer.name) {
      ownerLawyerPrefill = {
        name: property.ownerLawyer.name,
        phone: property.ownerLawyer.phone ?? undefined,
        email: property.ownerLawyer.email ?? undefined,
      };
    }

  } else {
    propertyPatch = {
      selectedItemId: null,
      neighbourhood: parsed.data.neighbourhood || undefined,
      street: parsed.data.street || undefined,
      buildingNumber: parsed.data.buildingNumber || undefined,
      apartmentNumber: parsed.data.apartmentNumber || undefined,
      gushChelka: parsed.data.gushChelka || undefined,
      rooms:
        typeof parsed.data.rooms === "number" ? parsed.data.rooms : undefined,
      sizeSqm:
        typeof parsed.data.sizeSqm === "number"
          ? parsed.data.sizeSqm
          : undefined,
    };
  }

  // Pre-seed priceTerms from the property if picker mode AND the user hasn't
  // already entered values for them on a prior visit to the price-terms page.
  const current = await loadDraft(session.agentId);
  const priceTerms = {
    ...current.priceTerms,
    ...(pricePrefill !== null && current.priceTerms?.price === undefined
      ? { price: pricePrefill }
      : {}),
    ...(paymentTermsPrefill !== null &&
    current.priceTerms?.paymentTerms === undefined
      ? { paymentTerms: paymentTermsPrefill }
      : {}),
  };

  // Seed owners + owner lawyer only on first arrival OR when picker selection
  // changed. Don't clobber a user-edited owners list.
  const ownersPatch =
    ownerPrefill && (!current.owners || current.owners.length === 0)
      ? {
          owners: [ownerPrefill],
          // Only relevant alongside a fresh seed above — a returning agent
          // who's already looked at/edited the owner form doesn't need the
          // notice re-surfaced.
          ownerTeudatZehutAutofilled: teudatZehutFromSignedContracts,
        }
      : {};
  const ownerLawyerPatch =
    ownerLawyerPrefill && !current.ownerLawyer
      ? { ownerLawyer: ownerLawyerPrefill }
      : {};

  await advanceDraft(session.agentId, "property", {
    property: propertyPatch,
    priceTerms,
    ...ownersPatch,
    ...ownerLawyerPatch,
  });

  const destination = formData.get(WIZARD_DESTINATION_FIELD);
  redirect(
    stepHref(
      destinationStep(
        "property",
        typeof destination === "string" ? destination : null,
      ),
    ),
  );
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("submitProperty failed:", e);
    redirect(stepHref("property") + "?error=save");
  }
}
