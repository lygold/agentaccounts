import { getTranslations } from "next-intl/server";
import type { WizardDraft } from "./draft";
import type { WizardStep } from "./steps";

/**
 * Ported verbatim from sikkumPigisha's src/lib/validation.ts — required-field
 * rules are UNCHANGED. See that repo's history for why these specific fields
 * are required (sourced from the PDF template's "required" markers, not the
 * Make scenario's own buggier filter).
 *
 * Empty result = all required fields present → status will be "building pdf".
 * Any issues → status stays "Manual Steps Necessary" and the doc won't be
 * auto-sent. The wizard still lets the user submit either way.
 */
export interface ValidationIssue {
  /** Localized message describing what's missing. */
  message: string;
  /** Step slug to deep-link the user to fix it. */
  step: WizardStep;
}

export async function validateDraft(draft: WizardDraft): Promise<ValidationIssue[]> {
  const t = await getTranslations("ValidationIssues");
  const issues: ValidationIssue[] = [];

  // ---- Step 4-6 — fundamental choices (should always be set if user reached review)
  if (!draft.language) {
    issues.push({ message: t("docLanguageMissing"), step: "language" });
  }
  if (!draft.dealType) {
    issues.push({ message: t("dealTypeMissing"), step: "deal-type" });
  }
  if (!draft.representation) {
    issues.push({ message: t("representationMissing"), step: "representation" });
  }

  // ---- Step 7 — property
  const p = draft.property;
  if (!p?.street) issues.push({ message: t("streetMissing"), step: "property" });
  if (!p?.buildingNumber)
    issues.push({ message: t("buildingNumberMissing"), step: "property" });
  if (!p?.apartmentNumber)
    issues.push({ message: t("apartmentNumberMissing"), step: "property" });
  if (!p?.neighbourhood)
    issues.push({ message: t("neighbourhoodMissing"), step: "property" });

  // ---- Step 8 — price
  if (!draft.priceTerms?.price) {
    issues.push({ message: t("priceMissing"), step: "price-terms" });
  }

  const isSale = draft.dealType === "sale";
  const representsOwner =
    draft.representation === "owner" || draft.representation === "both";
  const representsBuyer =
    draft.representation === "buyer" || draft.representation === "both";

  // ---- Step 9 — owners
  const owner1 = draft.owners?.[0];
  if (!owner1?.name) {
    issues.push({
      message: t("ownerNameMissing"),
      step: "owners",
    });
  }
  // Contact details only required when agent represents this side.
  // If they don't represent owners, only the name is needed.
  if (representsOwner && owner1?.name && !owner1.phone && !owner1.email) {
    issues.push({
      message: t("ownerContactMissing"),
      step: "owners",
    });
  }
  if (representsOwner && owner1?.name && !owner1.teudatZehut) {
    issues.push({
      message: t("ownerIdMissing"),
      step: "owners",
    });
  }

  // ---- Step 10 — owner lawyer (Sale only)
  if (isSale) {
    const ol = draft.ownerLawyer;
    if (!ol?.name) {
      issues.push({ message: t("ownerLawyerNameMissing"), step: "owner-lawyer" });
    }
    if (ol?.name && !ol.phone && !ol.email) {
      issues.push({
        message: t("ownerLawyerContactMissing"),
        step: "owner-lawyer",
      });
    }
  }

  // ---- Step 11 — owner agent
  const oa = draft.ownerAgent;
  if (!oa?.name) {
    issues.push({ message: t("ownerAgentNameMissing"), step: "owner-agent" });
  }
  if (oa?.name && !oa.phone && !oa.email) {
    issues.push({
      message: t("ownerAgentContactMissing"),
      step: "owner-agent",
    });
  }

  // ---- Step 12 — buyers
  const buyer1 = draft.buyers?.[0];
  if (!buyer1?.name) {
    issues.push({
      message: t("buyerNameMissing"),
      step: "buyers",
    });
  }
  if (representsBuyer && buyer1?.name && !buyer1.phone && !buyer1.email) {
    issues.push({
      message: t("buyerContactMissing"),
      step: "buyers",
    });
  }
  if (representsBuyer && buyer1?.name && !buyer1.teudatZehut) {
    issues.push({
      message: t("buyerIdMissing"),
      step: "buyers",
    });
  }

  // ---- Step 13 — buyer lawyer (Sale only)
  if (isSale) {
    const bl = draft.buyerLawyer;
    if (!bl?.name) {
      issues.push({ message: t("buyerLawyerNameMissing"), step: "buyer-lawyer" });
    }
    if (bl?.name && !bl.phone && !bl.email) {
      issues.push({
        message: t("buyerLawyerContactMissing"),
        step: "buyer-lawyer",
      });
    }
  }

  // ---- Step 14 — buyer agent
  const ba = draft.buyerAgent;
  if (!ba?.name) {
    issues.push({ message: t("buyerAgentNameMissing"), step: "buyer-agent" });
  }
  if (ba?.name && !ba.phone && !ba.email) {
    issues.push({
      message: t("buyerAgentContactMissing"),
      step: "buyer-agent",
    });
  }

  return issues;
}

export async function isComplete(draft: WizardDraft): Promise<boolean> {
  return (await validateDraft(draft)).length === 0;
}
