"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session-cookie";
import { getAgentById } from "@/lib/store/agents";
import { loadDraft, patchDraft } from "@/lib/wizard/draft";
import { validateDraft } from "@/lib/wizard/validation";
import {
  createDealItem,
  setPropertyListingStatus,
  setOfferStatus,
  writeBackClients,
  type ClientWriteBackPerson,
} from "@/lib/wizard/monday";
import { logAudit } from "@/lib/auth/audit";

/**
 * Final submit. Builds a Monday create_item payload from the draft, sets the
 * pdfStatus status column to "building pdf" or "Manual Steps Necessary" based
 * on whether all required fields are filled, audits the submission, and
 * routes to the success page.
 *
 * The existing Make.com scenario watches the pdfStatus column and runs the
 * Google Docs template + email send for items that land in "building pdf".
 * "Manual Steps Necessary" stays on the board for office staff to follow up.
 */
export async function submitDeal() {
  const session = await requireSession();
  const draft = await loadDraft(session.agentId);
  const issues = await validateDraft(draft);
  const complete = issues.length === 0;

  let mondayItemId: string;
  try {
    const result = await createDealItem(draft, session, issues);
    mondayItemId = result.id;
  } catch (err) {
    console.error("Monday create_item failed", (err as Error).message, JSON.stringify((err as any).cause));
    // Bounce the user back to review with a flag so the page can show an
    // error banner — they can retry without re-entering anything (draft
    // still in Redis).
    redirect("/deals/new/review?error=monday");
  }

  await logAudit({
    kind: "deal_submit",
    agentId: session.agentId,
    mondayItemId,
    ready: complete,
  });

  // Now that the deal is safely on Monday, advance the listing to "In Negotiation".
  // Fire-and-forget — don't block the success redirect on a status update.
  if (draft.property?.selectedItemId) {
    setPropertyListingStatus(draft.property.selectedItemId, "inNegotiation").catch(
      (err) => console.error("Failed to set listing status after submit:", err),
    );
  }

  // Same idea for a selected Offers-board suggestion — mark it Accepted now
  // that the deal is actually submitted, not back when it was just picked
  // on the buyers step (the agent could still have backed out before this).
  if (draft.selectedOfferId) {
    setOfferStatus(draft.selectedOfferId, "accepted").catch((err) =>
      console.error("Failed to set offer status after submit:", err),
    );
  }

  // Keep the contacts board in sync with what was actually filled in.
  // Fire-and-forget, same as the listing-status update above. Only a real
  // Properties-board id (picker path) can be linked — manually-entered
  // properties have no board item yet, so those writes skip the property
  // link (deferred, see writeBackClients doc comment).
  const isRental = draft.dealType === "rental";
  const writeBackPeople: ClientWriteBackPerson[] = [
    ...(draft.owners ?? []).map((input) => ({
      input,
      role: (isRental ? "landlord" : "seller") as ClientWriteBackPerson["role"],
    })),
    ...(draft.buyers ?? []).map((input) => ({
      input,
      role: (isRental ? "renter" : "buyer") as ClientWriteBackPerson["role"],
    })),
  ];
  // Ownership resolution inside writeBackClients follows the Contacts
  // board's property link back to Properties Raw Data's own Monday
  // board_relation — needs this agent's Monday pulse id, not agentLedger's
  // own agt_<uuid>. Skip the write-back (non-fatal, same as any other
  // failure here) if this agent has no Monday-linked identity.
  const agentForWriteBack = await getAgentById(session.agentId);
  if (agentForWriteBack?.mondayItemId) {
    writeBackClients(
      writeBackPeople,
      { id: agentForWriteBack.mondayItemId, name: session.agentName },
      draft.property?.selectedItemId ?? null,
    ).catch((err) => console.error("writeBackClients failed after submit:", err));
  }

  redirect(`/deals/new/done?complete=${complete ? "1" : "0"}`);
}

/**
 * Link a review-page "did you mean" match to the draft's property WITHOUT
 * touching any other field. Unlike the property step's version of this
 * confirm (which re-fetches the listing and overwrites price/owner/etc —
 * safe there because those fields are still empty at that point), by the
 * time the agent reaches review those fields may already hold AI-extracted
 * or hand-typed values that are more current than the board. All this does
 * is set selectedItemId so submitDeal() can flip the listing to "In
 * Negotiation" on submit.
 */
export async function linkMatchedProperty(itemId: string) {
  const session = await requireSession();
  const draft = await loadDraft(session.agentId);
  if (!draft.property) return;
  await patchDraft(session.agentId, {
    property: { ...draft.property, selectedItemId: itemId },
  });
  revalidatePath("/deals/new/review");
}
