import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session-cookie";
import { getAgentById } from "@/lib/store/agents";
import { loadDraft } from "@/lib/wizard/draft";
import { listBuyersWithCommissionForAgent } from "@/lib/wizard/monday";
import type { ClientCommissionSummary } from "@/lib/wizard/monday";
import { findMatchingClientsByProperty } from "@/lib/wizard/offer-match";
import { parseMonthsText, parsePercentText } from "@/lib/wizard/commission";
import { WizardChrome } from "@/components/wizard-chrome";
import { CommissionForm, type CommissionPrefill } from "@/components/commission-form";
import { submitBuyerCommission } from "./actions";

/**
 * Buyer/renter side: Signed Contracts only (no Properties-board equivalent,
 * and no referral prefill — the office confirmed no source exists for that
 * on this side). Sale uses the highest matching "Buyer" record's commission
 * text; rental uses the first matching "Renter" record's months-of-rent text.
 *
 * `agentId` is the agent's MONDAY pulse id, not agentLedger's agt_<uuid> —
 * see the identical note on owner-commission/page.tsx.
 */
async function getBuyerCommissionPrefill(
  agentId: string,
  dealType: "sale" | "rental",
  property: { street?: string; buildingNumber?: string } | undefined,
): Promise<CommissionPrefill | null> {
  try {
    if (!property?.street) return null;
    const buyers = await listBuyersWithCommissionForAgent(agentId, { dealType });
    const matches = findMatchingClientsByProperty(
      buyers,
      property.street,
      property.buildingNumber,
    ) as ClientCommissionSummary[];

    if (dealType === "sale") {
      let percent: number | null = null;
      for (const m of matches) {
        const pct = parsePercentText(m.commissionSaleText);
        if (pct !== null && (percent === null || pct > percent)) percent = pct;
      }
      if (percent === null) return null;
      return { unit: "percentage", amount: percent, vatMode: "plus" };
    }

    for (const m of matches) {
      const months = parseMonthsText(m.commissionRentalText);
      if (months !== null) return { unit: "months", amount: months, vatMode: "plus" };
    }
    return null;
  } catch {
    return null;
  }
}

export default async function BuyerCommissionPage() {
  const session = await requireSession();
  const draft = await loadDraft(session.agentId);
  if (!draft.language) redirect("/deals/new/language");
  if (!draft.dealType) redirect("/deals/new/deal-type");
  if (!draft.representation) redirect("/deals/new/representation");

  const agent = await getAgentById(session.agentId);
  const prefill =
    draft.buyerCommission || !agent?.mondayItemId
      ? null
      : await getBuyerCommissionPrefill(agent.mondayItemId, draft.dealType, draft.property);

  return (
    <WizardChrome step="buyer-commission" furthestStep={draft.furthestStep}>
      <CommissionForm
        dealType={draft.dealType}
        price={draft.priceTerms?.price}
        action={submitBuyerCommission}
        initial={draft.buyerCommission}
        prefill={prefill}
      />
    </WizardChrome>
  );
}
