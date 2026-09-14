import "server-only";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { DEALS_BOARD, STATUS_LABELS } from "./columns";
import { getDealsBoardId, mondayQuery } from "../../monday/client";
import {
  computeExpectedBillPreVat,
  computeNormalizedCommissionPercent,
  computeReferralNormalizedPercent,
  formatReferralContact,
} from "../commission";
import type { CommissionInput, CommissionUnit, WizardDraft as Draft } from "../draft";
import type { SessionPayload } from "../../auth/session";
import type { ValidationIssue } from "../validation";

/**
 * Create a new deal item on the properties board from a completed wizard
 * draft. Returns the new item's ID.
 *
 * Sets pdfStatus to "building pdf" when validation passes, else
 * "Manual Steps Necessary" — the existing Make scenario watches that column
 * and triggers the doc-generation step only on "building pdf".
 */
export async function createDealItem(
  draft: Draft,
  session: SessionPayload,
  issues: ValidationIssue[],
): Promise<{ id: string }> {
  const columnValues = buildColumnValues(draft, session, issues);
  const itemName = buildItemName(draft);

  const mutation = /* GraphQL */ `
    mutation CreateDeal(
      $boardId: ID!
      $itemName: String!
      $columnValues: JSON!
    ) {
      create_item(
        board_id: $boardId
        item_name: $itemName
        column_values: $columnValues
        create_labels_if_missing: false
      ) {
        id
      }
    }
  `;

  const data = await mondayQuery<{ create_item: { id: string } }>(mutation, {
    boardId: getDealsBoardId(),
    itemName,
    columnValues: JSON.stringify(columnValues),
  });
  const id = data.create_item.id;

  // Fire-and-forget, same as the other post-creation writes in
  // review/actions.ts (listing status, offer status, contacts write-back) —
  // never block the success redirect on this.
  postCommissionUpdates(id, draft).catch((err) =>
    console.error("postCommissionUpdates failed:", err),
  );

  return { id };
}

function buildItemName(draft: Draft): string {
  const parts = [
    draft.property?.street,
    draft.property?.buildingNumber,
    draft.property?.apartmentNumber
      ? `דירה ${draft.property.apartmentNumber}`
      : null,
  ].filter(Boolean);
  if (parts.length > 0) return parts.join(" ");
  // Fallback if no address — should be rare since address fields are advisory-required.
  return `סיכום פגישה ${new Date().toLocaleDateString("he-IL")}`;
}


/**
 * Build the `column_values` JSON Monday expects. Each column type has its own
 * shape — text is a bare string, status uses {label}, phone uses {phone},
 * etc. We OMIT undefined / empty fields so they stay blank on the board
 * rather than getting written as empty strings.
 */
function buildColumnValues(
  draft: Draft,
  session: SessionPayload,
  issues: ValidationIssue[],
): Record<string, unknown> {
  const cv: Record<string, unknown> = {};
  const dcols = DEALS_BOARD;

  const validationPassed = issues.length === 0;
  const isSale = draft.dealType === "sale";
  // A colleague confirmed on the "other side" step counts as represented for
  // the office automation's purposes, even though this agent personally only
  // handled one side — otherwise a two-agent same-office deal reads as
  // one-sided and the automation never adds the other party.
  const otherSideIsColleague = draft.otherSideRepresentedBy === "colleague";
  const representsOwner =
    draft.representation === "owner" ||
    draft.representation === "both" ||
    (draft.representation === "buyer" && otherSideIsColleague);
  const representsBuyer =
    draft.representation === "buyer" ||
    draft.representation === "both" ||
    (draft.representation === "owner" && otherSideIsColleague);

  // ---- Meta / status
  if (draft.dealType) {
    // Deals board uses English labels ("Sale"/"Rental"), not Hebrew.
    cv[dcols.meta.dealType] = {
      label: STATUS_LABELS.dealTypeDeal[draft.dealType],
    };
  }
  if (draft.language) {
    cv[dcols.meta.docProduction] = {
      label: STATUS_LABELS.docProduction[draft.language],
    };
  }
  cv[dcols.meta.pdfStatus] = {
    label: validationPassed
      ? STATUS_LABELS.pdfStatus.buildingPdf
      : STATUS_LABELS.pdfStatus.manualStepsNecessary,
  };
  // agentLedger's SessionPayload.agentEmail is nullable (phone-only login is
  // valid here) — omit the column rather than write {email: null, text: null},
  // consistent with this function's own "omit undefined/empty fields" rule.
  if (session.agentEmail) {
    cv[dcols.meta.filledOutBy] = {
      email: session.agentEmail,
      text: session.agentEmail,
    };
  }
  cv[dcols.meta.creationDate] = {
    date: new Date().toISOString().slice(0, 10),
  };
  if (draft.signingDate) {
    cv[dcols.meta.expectedSigningDate] = { date: draft.signingDate };
  }
  if (draft.notes) {
    cv[dcols.meta.additionalNotes] = { text: draft.notes };
  }
  // ---- Office notes + missing-fields list
  // When validation failed, append a ⚠️ list of every missing field so office
  // staff can see at a glance what needs to be chased — no hunting column by column.
  // Format: agent's notes first (more urgent context), then separator, then list.
  {
    const missingNote = !validationPassed
      ? `⚠️ שדות חסרים:\n${issues.map((i) => `- ${i.message}`).join("\n")}`
      : null;
    const combined = [draft.officeNotes?.trim() || null, missingNote]
      .filter(Boolean)
      .join("\n----------\n");
    if (combined) cv[dcols.meta.officeNotes] = { text: combined };
  }

  // ---- Representation flags
  if (draft.representation) {
    cv[dcols.representation.representsOwner] = {
      label: representsOwner
        ? STATUS_LABELS.representation.yes
        : STATUS_LABELS.representation.no,
    };
    cv[dcols.representation.representsBuyer] = {
      label: representsBuyer
        ? STATUS_LABELS.representation.yes
        : STATUS_LABELS.representation.no,
    };
  }

  // ---- Property
  const p = draft.property;
  if (p?.neighbourhood) cv[dcols.property.neighbourhood] = p.neighbourhood;
  if (p?.street) cv[dcols.property.street] = p.street;
  if (p?.buildingNumber) cv[dcols.property.buildingNumber] = p.buildingNumber;
  if (p?.apartmentNumber)
    cv[dcols.property.apartmentNumber] = p.apartmentNumber;
  if (p?.gushChelka) cv[dcols.property.gushChelka] = p.gushChelka;
  if (p?.rooms !== undefined) cv[dcols.property.rooms] = p.rooms;
  if (p?.sizeSqm !== undefined) cv[dcols.property.sizeSqm] = p.sizeSqm;

  // ---- Price + terms
  const pt = draft.priceTerms;
  if (pt?.price !== undefined) cv[dcols.property.price] = pt.price;
  // Currency symbol written to its own column so the document template can
  // display e.g. "₪ 2,500,000" or "$ 850,000" without extra formatting logic.
  cv[dcols.property.currency] = pt?.currency === "USD" ? "$" : "₪";
  if (pt?.paymentTerms?.trim())
    cv[dcols.property.paymentTerms] = { text: pt.paymentTerms.trim() };
  if (pt?.vacatingDate) cv[dcols.property.vacatingDate] = { date: pt.vacatingDate };

  // ---- Owner side
  const o1 = draft.owners?.[0];
  if (o1) writePerson(cv, dcols.ownerSide, o1, 0);
  const o2 = draft.owners?.[1];
  if (o2) writePerson(cv, dcols.ownerSide, o2, 1);
  const ownerCount = (draft.owners ?? []).filter((o) => o.name).length;
  cv[dcols.ownerSide.ownerCount] = {
    label: ownerCount >= 3
      ? STATUS_LABELS.personCount.threeOrMore
      : ownerCount === 2
        ? STATUS_LABELS.personCount.two
        : STATUS_LABELS.personCount.one,
  };
  if (draft.ownerCommunicationLang) {
    cv[dcols.ownerSide.communicationLang] = {
      label: STATUS_LABELS.communicationLang[draft.ownerCommunicationLang],
    };
  }
  if (draft.ownerLawyer) {
    if (draft.ownerLawyer.name)
      cv[dcols.ownerSide.lawyerName] = draft.ownerLawyer.name;
    if (draft.ownerLawyer.phone)
      cv[dcols.ownerSide.lawyerPhone] = phoneValue(draft.ownerLawyer.phone);
    if (draft.ownerLawyer.email)
      cv[dcols.ownerSide.lawyerEmail] = emailValue(draft.ownerLawyer.email);
  }
  if (draft.ownerAgent) {
    if (draft.ownerAgent.name)
      cv[dcols.ownerSide.agentName] = draft.ownerAgent.name;
    if (draft.ownerAgent.phone)
      cv[dcols.ownerSide.agentPhone] = phoneValue(draft.ownerAgent.phone);
    if (draft.ownerAgent.email)
      cv[dcols.ownerSide.agentEmail] = emailValue(draft.ownerAgent.email);
  }

  // ---- Buyer side
  const b1 = draft.buyers?.[0];
  if (b1) writePerson(cv, dcols.buyerSide, b1, 0);
  const b2 = draft.buyers?.[1];
  if (b2) writePerson(cv, dcols.buyerSide, b2, 1);
  const buyerCount = (draft.buyers ?? []).filter((b) => b.name).length;
  cv[dcols.buyerSide.buyerCount] = {
    label: buyerCount >= 3
      ? STATUS_LABELS.personCount.threeOrMore
      : buyerCount === 2
        ? STATUS_LABELS.personCount.two
        : STATUS_LABELS.personCount.one,
  };
  if (draft.buyerCommunicationLang) {
    cv[dcols.buyerSide.communicationLang] = {
      label: STATUS_LABELS.communicationLang[draft.buyerCommunicationLang],
    };
  }
  if (draft.buyerLawyer) {
    if (draft.buyerLawyer.name)
      cv[dcols.buyerSide.lawyerName] = draft.buyerLawyer.name;
    if (draft.buyerLawyer.phone)
      cv[dcols.buyerSide.lawyerPhone] = phoneValue(draft.buyerLawyer.phone);
    if (draft.buyerLawyer.email)
      cv[dcols.buyerSide.lawyerEmail] = emailValue(draft.buyerLawyer.email);
  }
  if (draft.buyerAgent) {
    if (draft.buyerAgent.name)
      cv[dcols.buyerSide.agentName] = draft.buyerAgent.name;
    if (draft.buyerAgent.phone)
      cv[dcols.buyerSide.agentPhone] = phoneValue(draft.buyerAgent.phone);
    if (draft.buyerAgent.email)
      cv[dcols.buyerSide.agentEmail] = emailValue(draft.buyerAgent.email);
  }

  // ---- Commission (internal only, never in the PDF — see src/lib/commission.ts).
  // Raw entered figures aren't written as columns at all, only the normalized
  // percentage + referral contact info — the raw breakdown goes into a
  // Monday update instead, posted after item creation (postCommissionUpdates).
  writeCommissionColumns(cv, dcols.ownerCommission, draft.ownerCommission, pt?.price);
  writeCommissionColumns(cv, dcols.buyerCommission, draft.buyerCommission, pt?.price);

  return cv;
}

/** Guards each commission column write independently against a still-
 *  unbuilt placeholder ID, so a future partially-created column set degrades
 *  gracefully instead of failing createDealItem entirely. All 8 commission
 *  columns are real as of the Deals_Raw_Data board update — see columns.ts —
 *  but the guard costs nothing to keep. */
function isPendingColumn(id: string): boolean {
  return id.startsWith("__PENDING_");
}

function writeCommissionColumns(
  cv: Record<string, unknown>,
  cols: { percent: string; referralName: string; referralPhone: string; referralPercent: string },
  commission: CommissionInput | undefined,
  price: number | undefined,
) {
  if (!commission) return;
  const normalizedPct = computeNormalizedCommissionPercent(commission, price);
  if (normalizedPct !== null && !isPendingColumn(cols.percent)) {
    cv[cols.percent] = normalizedPct;
  }
  if (commission.referral && !isPendingColumn(cols.referralName)) {
    cv[cols.referralName] = formatReferralContact(commission.referral);
  }
  if (commission.referral?.phone && !isPendingColumn(cols.referralPhone)) {
    cv[cols.referralPhone] = phoneValue(commission.referral.phone);
  }
  if (commission.referral && !isPendingColumn(cols.referralPercent)) {
    const referralPct = computeReferralNormalizedPercent(normalizedPct, commission.referral, price);
    if (referralPct !== null) cv[cols.referralPercent] = referralPct;
  }
}

function writePerson(
  cv: Record<string, unknown>,
  side: typeof DEALS_BOARD.ownerSide | typeof DEALS_BOARD.buyerSide,
  person: { name: string; teudatZehut?: string; phone?: string; email?: string },
  index: 0 | 1,
) {
  const nameCol = index === 0 ? side.name : side.name2;
  const phoneCol = index === 0 ? side.phone : side.phone2;
  const emailCol = index === 0 ? side.email : side.email2;
  const tzCol = index === 0 ? side.teudatZehut : side.teudatZehut2;

  if (person.name) cv[nameCol] = person.name;
  if (person.phone) cv[phoneCol] = phoneValue(person.phone);
  if (person.email) cv[emailCol] = emailValue(person.email);
  if (person.teudatZehut) cv[tzCol] = person.teudatZehut;
}

export function phoneValue(phone: string): { phone: string; countryShortName: string } {
  // Monday's phone column expects E.164-ish formatting. Mobile keyboards on
  // RTL (Hebrew) locales can inject invisible bidi control characters
  // (e.g. U+202D/U+202C) around the digits, so we allowlist digits and a
  // leading "+" rather than blocklisting known punctuation.
  const stripped = phone.replace(/[^\d+]/g, "");
  const normalised = stripped.startsWith("+")
    ? "+" + stripped.slice(1).replace(/\+/g, "")
    : stripped.replace(/\+/g, "");

  // PhoneInput submits E.164 (e.g. "+15551234567"), so this resolves the
  // real country in the common case. Default region "IL" only matters for
  // numbers with no country code at all (older drafts, direct API calls).
  const parsed = parsePhoneNumberFromString(normalised, "IL");
  if (parsed) {
    // parsed.country can be undefined when the calling code is shared by
    // several countries (e.g. +1 covers US/Canada/Caribbean) and the area
    // code doesn't disambiguate. Never guess "IL" for a number that was
    // explicitly typed with a different country code — fall back to the
    // most common country for that calling code instead.
    const country = parsed.country ?? (parsed.countryCallingCode === "1" ? "US" : undefined);
    return { phone: parsed.number, countryShortName: country ?? "IL" };
  }
  return { phone: normalised, countryShortName: "IL" };
}

export function emailValue(email: string): { email: string; text: string } {
  return { email, text: email };
}

const CREATE_DEAL_UPDATE_MUTATION = /* GraphQL */ `
  mutation CreateDealUpdate($itemId: ID!, $body: String!) {
    create_update(item_id: $itemId, body: $body) {
      id
    }
  }
`;

const COMMISSION_UNIT_LABELS_HE: Record<CommissionUnit, string> = {
  percentage: "אחוז",
  shekel: "₪",
  months: "חודשי שכירות",
};
const REFERRAL_UNIT_LABELS_HE: Record<"percentage" | "shekel", string> = {
  percentage: "אחוז (מהעמלה)",
  shekel: "₪",
};

function formatIlsHe(amount: number): string {
  return `₪${Math.round(amount).toLocaleString("he-IL")}`;
}

/** Raw entered figures for one side's commission (+ referral, if any),
 *  formatted for a Monday update — never written as columns, see
 *  writeCommissionColumns. Referral contact info isn't repeated here since
 *  it's already in the refName/refNum columns. */
function buildCommissionUpdateText(
  sideLabel: string,
  commission: CommissionInput | undefined,
  price: number | undefined,
): string | null {
  if (!commission) return null;
  const normalizedPct = computeNormalizedCommissionPercent(commission, price);
  const bill = computeExpectedBillPreVat(normalizedPct, price);

  const lines: string[] = [
    `עמלת ${sideLabel}:`,
    `הוזן: ${commission.amount} ${COMMISSION_UNIT_LABELS_HE[commission.unit]}, ${STATUS_LABELS.vatMode[commission.vatMode]}`,
  ];
  if (normalizedPct !== null) {
    lines.push(
      `מחושב (לפני מעמ): ${normalizedPct.toFixed(4)}% ממחיר` +
        (bill !== null ? ` (≈ ${formatIlsHe(bill)})` : ""),
    );
  }

  const referral = commission.referral;
  if (referral) {
    const referralPct = computeReferralNormalizedPercent(normalizedPct, referral, price);
    const referralBill = computeExpectedBillPreVat(referralPct, price);
    lines.push(
      "",
      `הפניה — הוזן: ${referral.amount} ${REFERRAL_UNIT_LABELS_HE[referral.unit]}, ${STATUS_LABELS.vatMode[referral.vatMode]}`,
    );
    if (referralPct !== null) {
      lines.push(
        `הפניה — מחושב (לפני מעמ): ${referralPct.toFixed(4)}% ממחיר` +
          (referralBill !== null ? ` (≈ ${formatIlsHe(referralBill)})` : ""),
      );
    }
  }

  return lines.join("\n");
}

/** Posts exactly two updates — one per side, never split further, never
 *  combined across sides (confirmed with the user). Each is independent:
 *  one side's failure doesn't block the other's. */
async function postCommissionUpdates(itemId: string, draft: Draft): Promise<void> {
  const price = draft.priceTerms?.price;
  const bodies = [
    buildCommissionUpdateText("בעל הנכס", draft.ownerCommission, price),
    buildCommissionUpdateText("הצד הקונה/שוכר", draft.buyerCommission, price),
  ];
  for (const body of bodies) {
    if (!body) continue;
    try {
      await mondayQuery(CREATE_DEAL_UPDATE_MUTATION, { itemId, body });
    } catch (err) {
      console.error("Failed to post a commission update:", err);
    }
  }
}
