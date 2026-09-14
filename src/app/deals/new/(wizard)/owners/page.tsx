import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth/session-cookie";
import { getAgentById } from "@/lib/store/agents";
import { loadDraft } from "@/lib/wizard/draft";
import { listSellersForAgent } from "@/lib/wizard/monday";
import { findMatchingClientsByProperty } from "@/lib/wizard/offer-match";
import { WizardChrome } from "@/components/wizard-chrome";
import { PersonsForm } from "@/components/persons-form";
import type { PersonSuggestion } from "@/components/person-suggestions";
import { submitOwners } from "./actions";

export default async function OwnersPage() {
  const session = await requireSession();
  const draft = await loadDraft(session.agentId);
  if (!draft.language) redirect("/deals/new/language");
  if (!draft.dealType) redirect("/deals/new/deal-type");
  if (!draft.representation) redirect("/deals/new/representation");

  // "Represents this side" determines whether ALL fields are required-for-PDF
  // or only the name (per the user spec: buyer-only sees full form, but only
  // name carries the "missing this blocks auto-PDF" star).
  const representsThisSide =
    draft.representation === "owner" || draft.representation === "both";

  const t = await getTranslations("OwnersStep");
  const common = await getTranslations("Common");

  // Labels swap based on Sale vs. Rental.
  const isRental = draft.dealType === "rental";
  const singleTitle = isRental ? t("titleLandlord") : t("titleOwner");

  // Suggest sellers/landlords for manually-entered properties only — a
  // picker-selected listing already carries its own authoritative owner
  // (name/phone/email from the Properties board, seeded on the property
  // step); surfacing a second, possibly-different suggestion there would
  // just confuse the agent. Signed Contracts is the only source here (no
  // owner-side equivalent of the Offers board), so this only makes sense
  // when representing the owner side — same reasoning as the buyers step's
  // Signed Contracts fallback.
  let ownerSuggestions: PersonSuggestion[] = [];
  const isManualEntry = !draft.property?.selectedItemId;
  // Board ownership on Signed Contracts is a Monday board_relation to the
  // (Monday) agents board, so this needs the agent's Monday pulse id, not
  // agentLedger's own agt_<uuid>.
  const agent = await getAgentById(session.agentId);
  if (isManualEntry && representsThisSide && draft.property?.street && agent?.mondayItemId) {
    try {
      const sellers = await listSellersForAgent(agent.mondayItemId, {
        dealType: draft.dealType,
      });
      const matches = findMatchingClientsByProperty(
        sellers,
        draft.property.street,
        draft.property.buildingNumber,
      );
      ownerSuggestions = matches.map((c) => ({
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
    } catch {
      // Non-fatal — suggestions just won't show, agent falls back to manual entry.
      ownerSuggestions = [];
    }
  }

  return (
    <WizardChrome step="owners" furthestStep={draft.furthestStep}>
      <PersonsForm
        side="owner"
        action={submitOwners}
        initial={draft.owners}
        requireAllFields={representsThisSide}
        showCommunicationLang={representsThisSide}
        initialCommunicationLang={draft.ownerCommunicationLang}
        suggestions={ownerSuggestions}
        suggestionsTitle={t("suggestionsTitle")}
        teudatZehutAutofillNotice={
          draft.ownerTeudatZehutAutofilled
            ? t("teudatZehutAutofillNotice")
            : undefined
        }
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
