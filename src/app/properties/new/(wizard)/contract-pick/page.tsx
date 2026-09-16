import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth/session-cookie";
import { getAgentById } from "@/lib/store/agents";
import { loadPropertyDraft } from "@/lib/property-wizard/draft";
import { listSellersForPropertyWizard } from "@/lib/wizard/monday";
import { PropertyWizardChrome } from "@/components/property-wizard-chrome";
import { ContractPickForm } from "./contract-pick-form";

/**
 * Step 2 — pick from the agent's own signed contracts (seller for a sale,
 * landlord for a rental) to prefill owner + address + commission, or fall
 * through to manual entry. Same Monday-pulse-id caveat as the deal
 * wizard's owner-commission step: board ownership needs
 * agent.mondayItemId, not agentLedger's own agt_<uuid>.
 */
export default async function ContractPickPage() {
  const session = await requireSession();
  const draft = await loadPropertyDraft(session.agentId);
  if (!draft.dealType) redirect("/properties/new/deal-type");
  const t = await getTranslations("ContractPickStep");

  const agent = await getAgentById(session.agentId);
  const contracts =
    agent?.mondayItemId
      ? await listSellersForPropertyWizard(agent.mondayItemId, { dealType: draft.dealType })
      : [];

  return (
    <PropertyWizardChrome step="contract-pick" furthestStep={draft.furthestStep}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          {draft.dealType === "rental" ? t("promptRental") : t("promptSale")}
        </p>
        <ContractPickForm
          contracts={contracts}
          initialSelectedId={draft.sourceContractMondayId}
          initialContractType={draft.contractType}
        />
      </div>
    </PropertyWizardChrome>
  );
}
