import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session-cookie";
import { getAgentById } from "@/lib/store/agents";
import { loadDraft } from "@/lib/wizard/draft";
import {
  getPropertyCommissionPrefill,
  listSellersWithCommissionForAgent,
} from "@/lib/wizard/monday";
import type { ClientCommissionSummary } from "@/lib/wizard/monday";
import { findMatchingClientsByProperty } from "@/lib/wizard/offer-match";
import { parseMonthsText, parsePercentText } from "@/lib/wizard/commission";
import { WizardChrome } from "@/components/wizard-chrome";
import { CommissionForm, type CommissionPrefill } from "@/components/commission-form";
import { submitOwnerCommission } from "./actions";

/**
 * Sale: higher of the picker-selected listing's own commission % (Properties
 * board, sale listings only) vs. the highest matching Signed Contracts
 * seller record. Rental: Signed Contracts landlord record only (months of
 * rent) — the Properties board is never read for rentals (its "100" often
 * means something unrelated on rental listings, confirmed by the office).
 * Referral prefill (owner side only) comes from the same Properties-board
 * query, sale listings only, same reasoning.
 *
 * `agentId` here is the agent's MONDAY pulse id (AgentRecord.mondayItemId),
 * not agentLedger's own agt_<uuid> — ownership on the Properties/Signed
 * Contracts boards is a Monday board_relation to the (Monday) agents board,
 * so this must match that identity space. See the page component below for
 * the resolve step.
 */
async function getOwnerCommissionPrefill(
  agentId: string,
  dealType: "sale" | "rental",
  property: { selectedItemId: string | null; street?: string; buildingNumber?: string } | undefined,
): Promise<CommissionPrefill | null> {
  try {
    let referral: CommissionPrefill["referral"];
    let listingPercent: number | null = null;
    let listingVatMode: "plus" | "included" | null = null;

    if (dealType === "sale" && property?.selectedItemId) {
      const propPrefill = await getPropertyCommissionPrefill(property.selectedItemId, agentId);
      listingPercent = propPrefill.saleCommissionPercent;
      listingVatMode = propPrefill.vatMode;
      if (propPrefill.referral.agentName) {
        referral = {
          agentName: propPrefill.referral.agentName,
          officeName: propPrefill.referral.officeName ?? undefined,
          phone: propPrefill.referral.phone ?? "",
          percent: propPrefill.referral.percent ?? 0,
        };
      }
    }

    if (dealType === "sale") {
      let contractPercent: number | null = null;
      if (property?.street) {
        const sellers = await listSellersWithCommissionForAgent(agentId, { dealType });
        const matches = findMatchingClientsByProperty(
          sellers,
          property.street,
          property.buildingNumber,
        ) as ClientCommissionSummary[];
        for (const m of matches) {
          const pct = parsePercentText(m.commissionSaleText);
          if (pct !== null && (contractPercent === null || pct > contractPercent)) {
            contractPercent = pct;
          }
        }
      }
      const best = [listingPercent, contractPercent].filter(
        (n): n is number => n !== null,
      );
      if (best.length === 0) return referral ? { unit: "percentage", amount: 0, vatMode: "plus", referral } : null;
      return {
        unit: "percentage",
        amount: Math.max(...best),
        vatMode: listingVatMode ?? "plus",
        referral,
      };
    }

    // Rental — Signed Contracts landlord record only, "N months of rent".
    if (property?.street) {
      const landlords = await listSellersWithCommissionForAgent(agentId, { dealType });
      const matches = findMatchingClientsByProperty(
        landlords,
        property.street,
        property.buildingNumber,
      ) as ClientCommissionSummary[];
      for (const m of matches) {
        const months = parseMonthsText(m.commissionRentalText);
        if (months !== null) {
          return { unit: "months", amount: months, vatMode: "plus" };
        }
      }
    }
    return null;
  } catch {
    // Non-fatal — the agent just enters commission manually.
    return null;
  }
}

export default async function OwnerCommissionPage() {
  const session = await requireSession();
  const draft = await loadDraft(session.agentId);
  if (!draft.language) redirect("/deals/new/language");
  if (!draft.dealType) redirect("/deals/new/deal-type");
  if (!draft.representation) redirect("/deals/new/representation");

  const agent = await getAgentById(session.agentId);
  const prefill =
    draft.ownerCommission || !agent?.mondayItemId
      ? null
      : await getOwnerCommissionPrefill(agent.mondayItemId, draft.dealType, draft.property);

  return (
    <WizardChrome step="owner-commission" furthestStep={draft.furthestStep}>
      <CommissionForm
        dealType={draft.dealType}
        price={draft.priceTerms?.price}
        action={submitOwnerCommission}
        initial={draft.ownerCommission}
        prefill={prefill}
      />
    </WizardChrome>
  );
}
