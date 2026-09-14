import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session-cookie";
import { getAgentById } from "@/lib/store/agents";
import { loadDraft } from "@/lib/wizard/draft";
import { listPropertiesForAgent } from "@/lib/wizard/monday";
import { WizardChrome } from "@/components/wizard-chrome";
import { PropertyForm } from "./property-form";

export default async function PropertyPage() {
  const session = await requireSession();
  const draft = await loadDraft(session.agentId);
  if (!draft.language) redirect("/deals/new/language");
  if (!draft.dealType) redirect("/deals/new/deal-type");
  if (!draft.representation) redirect("/deals/new/representation");

  // Picker is only meaningful if the agent represents the owner side.
  // Buyer-only sees a manual-entry form (it's not their listing).
  const hasListings =
    draft.representation === "owner" || draft.representation === "both";

  // Board ownership on Properties Raw Data is a Monday board_relation to the
  // (Monday) agents board — needs this agent's Monday pulse id, not
  // agentLedger's own agt_<uuid>.
  const agent = hasListings ? await getAgentById(session.agentId) : null;
  const properties =
    hasListings && agent?.mondayItemId
      ? await listPropertiesForAgent(agent.mondayItemId, {
          dealType: draft.dealType,
        })
      : [];

  return (
    <WizardChrome step="property" furthestStep={draft.furthestStep}>
      <PropertyForm
        properties={properties}
        hasListings={hasListings}
        initial={draft.property}
      />
    </WizardChrome>
  );
}
