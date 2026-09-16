"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session-cookie";
import { getAgentById } from "@/lib/store/agents";
import { advancePropertyDraft, loadPropertyDraft } from "@/lib/property-wizard/draft";
import { listSellersWithCommissionForAgent } from "@/lib/wizard/monday";
import { parsePercentText } from "@/lib/wizard/commission";
import { parseStreetAndBuilding } from "@/lib/property-wizard/address-parse";
import { nextPropertyStep, propertyStepHref } from "@/lib/property-wizard/steps";
import { isNextJsRedirect } from "@/lib/wizard/action-utils";
import type { DealSide } from "@/lib/types";

const PickerSchema = z.object({
  mode: z.literal("picker"),
  selectedItemId: z.string().min(1),
});
const ManualSchema = z.object({ mode: z.literal("manual") });
const Schema = z.discriminatedUnion("mode", [PickerSchema, ManualSchema]);

export async function submitContractPick(formData: FormData) {
  try {
    const session = await requireSession();
    const draft = await loadPropertyDraft(session.agentId);
    if (!draft.dealType) {
      redirect(propertyStepHref("deal-type"));
    }

    const parsed = Schema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return;
    // Destructured to a plain local — TS narrows discriminated unions on
    // simple identifiers reliably across awaits; narrowing on a nested
    // property path like `parsed.data.mode` is not guaranteed the same way.
    const data = parsed.data;

    if (data.mode === "manual") {
      await advancePropertyDraft(session.agentId, "contract-pick", {
        sourceContractMondayId: undefined,
        sourceContractRole: undefined,
      });
      redirect(propertyStepHref(nextPropertyStep("contract-pick")!));
      return;
    }

    // Picker mode — re-resolve the full record server-side; FormData only
    // carried the id, and this list is Monday-sourced so there's no local
    // store to getById from.
    const agent = await getAgentById(session.agentId);
    const contracts = agent?.mondayItemId
      ? await listSellersWithCommissionForAgent(agent.mondayItemId, { dealType: draft.dealType! })
      : [];
    const picked = contracts.find((c) => c.id === data.selectedItemId);
    if (!picked) return;

    const role: DealSide = draft.dealType === "rental" ? "landlord" : "seller";
    const commissionText =
      draft.dealType === "rental" ? picked.commissionRentalText : picked.commissionSaleText;
    const commissionPercent = parsePercentText(commissionText) ?? undefined;

    // Split "דרך חברון 54" into street + buildingNumber for an immediate
    // prefill — formattedAddress still carries the raw text into the
    // address step's Places search box, so the agent can still normalize
    // the street spelling from there; picking a suggestion overwrites
    // these same fields with Places' own values.
    const { street, buildingNumber } = picked.propertyAddress
      ? parseStreetAndBuilding(picked.propertyAddress)
      : {};

    await advancePropertyDraft(session.agentId, "contract-pick", {
      sourceContractMondayId: picked.id,
      sourceContractRole: role,
      ownerName: picked.name,
      ownerPhone: picked.phone ?? undefined,
      ownerEmail: picked.email ?? undefined,
      formattedAddress: picked.propertyAddress ?? undefined,
      street,
      buildingNumber,
      commissionPercent,
      commissionVatMode: commissionPercent != null ? "plus" : undefined,
    });
    redirect(propertyStepHref(nextPropertyStep("contract-pick")!));
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("submitContractPick failed:", e);
    redirect(propertyStepHref("contract-pick") + "?error=save");
  }
}
