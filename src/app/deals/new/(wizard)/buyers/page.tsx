import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth/session-cookie";
import { getAgentById } from "@/lib/store/agents";
import { loadDraft } from "@/lib/wizard/draft";
import { listClientsForAgent, listOffersForAgent } from "@/lib/wizard/monday";
import type { ClientSummary } from "@/lib/wizard/monday";
import { findMatchingOffers, findMatchingClientsByProperty } from "@/lib/wizard/offer-match";
import { WizardChrome } from "@/components/wizard-chrome";
import { PersonsForm } from "@/components/persons-form";
import type { PersonSuggestion } from "@/components/person-suggestions";
import { submitBuyers } from "./actions";

export default async function BuyersPage() {
  const session = await requireSession();
  const draft = await loadDraft(session.agentId);
  if (!draft.language) redirect("/deals/new/language");
  if (!draft.dealType) redirect("/deals/new/deal-type");
  if (!draft.representation) redirect("/deals/new/representation");

  const representsThisSide =
    draft.representation === "buyer" || draft.representation === "both";

  const t = await getTranslations("BuyersStep");
  const common = await getTranslations("Common");

  const isRental = draft.dealType === "rental";
  const singleTitle = isRental ? t("titleRenter") : t("titleBuyer");

  // Board ownership on Properties/Signed Contracts/Offers is a Monday
  // board_relation to the (Monday) agents board, so lookups need this
  // agent's Monday pulse id, not agentLedger's own agt_<uuid>.
  const agent = await getAgentById(session.agentId);
  const mondayAgentId = agent?.mondayItemId ?? null;

  // Fetch existing clients from the contracts board so the agent can pick
  // instead of typing. Only load when agent represents buyers/renters.
  let clients: ClientSummary[] = [];
  if (representsThisSide && mondayAgentId) {
    try {
      clients = await listClientsForAgent(mondayAgentId, {
        dealType: draft.dealType,
      });
    } catch {
      // Non-fatal — picker just won't show, agent falls back to manual entry.
      clients = [];
    }
  }

  // Property address hint for pre-filtering the client list.
  const propertyAddress = [
    draft.property?.street,
    draft.property?.buildingNumber,
  ]
    .filter(Boolean)
    .join(" ");

  // Suggest buyers for this property before the agent types anything.
  // Offers-board lookup runs regardless of representation — a buyer showing
  // up there is actually MORE likely when this agent represents the owner
  // (their own listing, a buyer bid on it via the public form) than when
  // they represent the buyer side. Signed Contracts is only checked as a
  // fallback when no offer matches, and only when representing this side —
  // that data source is specifically "buyers you already work with."
  let buyerSuggestions: PersonSuggestion[] = [];
  if (draft.property?.street && mondayAgentId) {
    try {
      const offers = await listOffersForAgent(mondayAgentId);
      const offerMatches = findMatchingOffers(
        offers,
        draft.property.street,
        draft.property.buildingNumber,
      );
      if (offerMatches.length > 0) {
        buyerSuggestions = offerMatches.map((o) => ({
          id: `offer-${o.id}`,
          source: "offer" as const,
          person1: { name: o.buyer1.name, idNumber: o.buyer1.idNumber },
          person2: o.buyer2
            ? { name: o.buyer2.name, idNumber: o.buyer2.idNumber }
            : null,
          contextLabel: o.propertyAddressText,
          offerId: o.id,
        }));
      } else if (representsThisSide) {
        const clientMatches = findMatchingClientsByProperty(
          clients,
          draft.property.street,
          draft.property.buildingNumber,
        );
        buyerSuggestions = clientMatches.map((c) => ({
          id: `client-${c.id}`,
          source: "signed-contract" as const,
          person1: {
            name: c.name,
            idNumber: c.idNumber,
            phone: c.phone,
            email: c.email,
          },
          contextLabel: c.propertyAddress,
          clientId: c.id,
        }));
      }
    } catch {
      // Non-fatal — suggestions just won't show, same as the picker above.
      buyerSuggestions = [];
    }
  }

  return (
    <WizardChrome step="buyers" furthestStep={draft.furthestStep}>
      <PersonsForm
        side="buyer"
        action={submitBuyers}
        initial={draft.buyers}
        requireAllFields={representsThisSide}
        showCommunicationLang={representsThisSide}
        initialCommunicationLang={draft.buyerCommunicationLang}
        availableClients={clients}
        propertyAddressHint={propertyAddress}
        suggestions={buyerSuggestions}
        suggestionsTitle={t("suggestionsTitle")}
        initialSelectedOfferId={draft.selectedOfferId}
        labels={{
          singleTitle,
          addAnother: t("addAnother", { title: singleTitle }),
          capNote: common("twoPersonCapNote"),
          commLangPrompt: t("commLangPrompt", { title: singleTitle }),
        }}
      />
    </WizardChrome>
  );
}
