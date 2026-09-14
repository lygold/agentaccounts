import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth/session-cookie";
import { loadDraft } from "@/lib/wizard/draft";
import { listAgentsByOffice, getAgentById } from "@/lib/store/agents";
import { WizardChrome } from "@/components/wizard-chrome";
import { PartyForm } from "@/components/party-form";
import { submitOwnerAgent } from "./actions";

export default async function OwnerAgentPage() {
  const session = await requireSession();
  const draft = await loadDraft(session.agentId);
  if (!draft.language) redirect("/deals/new/language");
  if (!draft.representation) redirect("/deals/new/representation");
  const t = await getTranslations("OwnerAgentStep");

  const representsThisSide =
    draft.representation === "owner" || draft.representation === "both";

  // Auto-fill from the logged-in agent if this is "their" side. Per user
  // spec: when the agent represents the owner side, their own contact
  // info should populate this page. Name follows the DOCUMENT's language
  // (draft.language) — not the UI locale — since this name is going into
  // the produced PDF, not the wizard chrome. Falls back to the Hebrew
  // board name if the agent has no English name on file.
  //
  // agentFullNameEnglish isn't on agentLedger's session (unlike
  // sikkumPigisha's own JWT) — fetched from the agents table instead, same
  // adaptation as wizard-chrome.tsx.
  const me = representsThisSide || draft.language === "english"
    ? await getAgentById(session.agentId)
    : null;
  const agentDisplayName =
    draft.language === "english"
      ? me?.fullNameEnglish || session.agentName
      : session.agentName;
  const initial =
    draft.ownerAgent ??
    (representsThisSide
      ? {
          name: agentDisplayName,
          phone: session.agentPhone ?? undefined,
          email: session.agentEmail ?? undefined,
        }
      : undefined);

  // Owner side confirmed as a colleague on the other-side step — offer a
  // picker instead of free-typing a fellow agent's contact details.
  const showColleaguePicker =
    !representsThisSide && draft.otherSideRepresentedBy === "colleague";
  const agentOptions = showColleaguePicker
    ? (await listAgentsByOffice(session.officeId))
        .filter((a) => a.id !== session.agentId && a.status === "active")
        .map((a) => ({ id: a.id, name: a.name, phone: a.phone, email: a.email }))
    : undefined;

  return (
    <WizardChrome step="owner-agent" furthestStep={draft.furthestStep}>
      <PartyForm
        action={submitOwnerAgent}
        initial={initial}
        nameRequired
        contactRequired
        agentOptions={agentOptions}
        intro={representsThisSide ? t("introAuto") : t("intro")}
      />
    </WizardChrome>
  );
}
