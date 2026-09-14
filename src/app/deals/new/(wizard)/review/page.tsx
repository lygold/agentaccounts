import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { AlertCircle, CheckCircle2, Pencil } from "lucide-react";
import { requireSession } from "@/lib/auth/session-cookie";
import { getAgentById } from "@/lib/store/agents";
import { loadDraft, type WizardDraft as Draft } from "@/lib/wizard/draft";
import { validateDraft } from "@/lib/wizard/validation";
import { computeNormalizedCommissionPercent } from "@/lib/wizard/commission";
import { stepHref, type WizardStep } from "@/lib/wizard/steps";
import { WizardChrome } from "@/components/wizard-chrome";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { listPropertiesForAgent } from "@/lib/wizard/monday";
import { findMatchingProperty } from "@/lib/wizard/property-match";
import { ReviewSubmitSection } from "./submit-section";
import { PropertyMatchPrompt } from "./property-match-prompt";

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireSession();
  const draft = await loadDraft(session.agentId);
  if (!draft.language) redirect("/deals/new/language");
  const t = await getTranslations("ReviewStep");

  const params = await searchParams;
  const sendError = params.error === "monday";

  const issues = await validateDraft(draft);
  const isComplete = issues.length === 0;

  // Deals that skip /form/property entirely (AI upload jumps straight to
  // review) — or where the agent typed manually without confirming a "did
  // you mean" match — never get selectedItemId set, so submitDeal() never
  // flips the listing to "In Negotiation". Check for an unambiguous match
  // here too, gated the same way the property step gates the picker.
  const hasListings =
    draft.representation === "owner" || draft.representation === "both";
  // Board ownership on Properties Raw Data is a Monday board_relation to the
  // (Monday) agents board — needs this agent's Monday pulse id, not
  // agentLedger's own agt_<uuid>.
  const agent =
    !draft.property?.selectedItemId && hasListings && draft.dealType
      ? await getAgentById(session.agentId)
      : null;
  const propertyMatch =
    !draft.property?.selectedItemId && hasListings && draft.dealType && agent?.mondayItemId
      ? findMatchingProperty(
          await listPropertiesForAgent(agent.mondayItemId, {
            dealType: draft.dealType,
          }),
          draft.property?.street,
          draft.property?.buildingNumber,
        )
      : null;

  // One link per issue — even if two issues share a step the agent sees each
  // missing field called out individually so nothing feels hidden.

  return (
    <WizardChrome step="review">
      <div className="flex flex-col gap-5">
        {sendError && (
          <Alert variant="destructive">
            <AlertDescription className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{t("mondayError")}</span>
            </AlertDescription>
          </Alert>
        )}

        {isComplete ? (
          <Alert variant="info">
            <AlertDescription className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{t("completeMessage")}</span>
            </AlertDescription>
          </Alert>
        ) : (
          <Alert variant="destructive">
            <AlertDescription>
              <p className="flex items-start gap-2 font-semibold">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>{t("incompleteMessage", { count: issues.length })}</span>
              </p>
              <ul className="mt-2 space-y-2 pe-6">
                {issues.map((issue, idx) => (
                  <li key={idx}>
                    <Link
                      href={stepHref(issue.step as never)}
                      className="font-medium text-secondary underline underline-offset-4"
                    >
                      {issue.message}
                    </Link>
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {propertyMatch && <PropertyMatchPrompt match={propertyMatch} />}

        <Summary draft={draft} />

        <ReviewSubmitSection
          label={isComplete ? t("submitComplete") : t("submitIncomplete")}
        />
      </div>
    </WizardChrome>
  );
}

/** Compact review-row rendering of a normalized commission percentage —
 *  never the raw entered figures (those only ever go to a Monday update,
 *  see src/lib/monday/deals.ts). */
function commissionSummaryText(
  commission: Draft["ownerCommission"],
  price: number | undefined,
  referralSuffix: string,
): string | null {
  if (!commission) return null;
  const pct = computeNormalizedCommissionPercent(commission, price);
  if (pct === null) return null;
  const base = `${pct.toFixed(2)}%`;
  return commission.referral ? `${base} (${referralSuffix})` : base;
}

async function Summary({ draft }: { draft: Draft }) {
  const t = await getTranslations("ReviewStep");
  const common = await getTranslations("Common");
  const dealTypeT = await getTranslations("DealTypeStep");
  const locale = await getLocale();

  const rows: Array<[string, string | null | undefined, WizardStep]> = [
    [
      t("rowLanguage"),
      draft.language === "english" ? common("english") : common("hebrew"),
      "language",
    ],
    [
      t("rowDealType"),
      draft.dealType === "rental" ? dealTypeT("rental") : dealTypeT("sale"),
      "deal-type",
    ],
    [t("rowSigningDate"), draft.signingDate ?? null, "signing-date"],
    [
      t("rowRepresentation"),
      draft.representation === "owner"
        ? t("representationOwner")
        : draft.representation === "buyer"
          ? t("representationBuyer")
          : t("representationBoth"),
      "representation",
    ],
    [
      t("rowAddress"),
      [
        draft.property?.street,
        draft.property?.buildingNumber,
        draft.property?.apartmentNumber
          ? t("apartmentPrefix", { number: draft.property.apartmentNumber })
          : null,
        draft.property?.neighbourhood
          ? `(${draft.property.neighbourhood})`
          : null,
      ]
        .filter(Boolean)
        .join(" "),
      "property",
    ],
    [
      t("rowRoomsSize"),
      [draft.property?.rooms, draft.property?.sizeSqm]
        .filter(Boolean)
        .join(" / ") || null,
      "property",
    ],
    [
      t("rowPrice"),
      draft.priceTerms?.price
        ? `${draft.priceTerms.currency === "USD" ? "$" : "₪"} ${draft.priceTerms.price.toLocaleString(locale)}`
        : null,
      "price-terms",
    ],
    [t("rowPaymentTerms"), draft.priceTerms?.paymentTerms, "price-terms"],
    [t("rowVacatingDate"), draft.priceTerms?.vacatingDate, "price-terms"],
    [
      t("rowOwners"),
      draft.owners
        ?.map((o) => [o.name, o.teudatZehut, o.phone, o.email].filter(Boolean).join(" • "))
        .join(" | ") || null,
      "owners",
    ],
    [
      t("rowOwnerCommission"),
      commissionSummaryText(draft.ownerCommission, draft.priceTerms?.price, t("commissionWithReferral")),
      "owner-commission",
    ],
    [
      t("rowOwnerLawyer"),
      [draft.ownerLawyer?.name, draft.ownerLawyer?.phone, draft.ownerLawyer?.email]
        .filter(Boolean)
        .join(" • ") || null,
      "owner-lawyer",
    ],
    [
      t("rowOwnerAgent"),
      [draft.ownerAgent?.name, draft.ownerAgent?.phone, draft.ownerAgent?.email]
        .filter(Boolean)
        .join(" • ") || null,
      "owner-agent",
    ],
    [
      t("rowBuyers"),
      draft.buyers
        ?.map((b) => [b.name, b.teudatZehut, b.phone, b.email].filter(Boolean).join(" • "))
        .join(" | ") || null,
      "buyers",
    ],
    [
      t("rowBuyerCommission"),
      commissionSummaryText(draft.buyerCommission, draft.priceTerms?.price, t("commissionWithReferral")),
      "buyer-commission",
    ],
    [
      t("rowBuyerLawyer"),
      [draft.buyerLawyer?.name, draft.buyerLawyer?.phone, draft.buyerLawyer?.email]
        .filter(Boolean)
        .join(" • ") || null,
      "buyer-lawyer",
    ],
    [
      t("rowBuyerAgent"),
      [draft.buyerAgent?.name, draft.buyerAgent?.phone, draft.buyerAgent?.email]
        .filter(Boolean)
        .join(" • ") || null,
      "buyer-agent",
    ],
    [t("rowNotes"), draft.notes, "notes"],
    [t("rowOfficeNotes"), draft.officeNotes, "office-notes"],
  ];

  // Group consecutive rows that belong to the same wizard step into one
  // clickable section (e.g. property's address + rooms/size rows together).
  const sections: Array<{ step: WizardStep; rows: typeof rows }> = [];
  for (const row of rows) {
    const last = sections[sections.length - 1];
    if (last && last.step === row[2]) {
      last.rows.push(row);
    } else {
      sections.push({ step: row[2], rows: [row] });
    }
  }

  return (
    <div className="divide-y overflow-hidden rounded-lg border">
      {sections.map((section) => (
        <Link
          key={section.step}
          href={stepHref(section.step)}
          title={t("editTitle")}
          className="group relative block transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none active:bg-muted/60"
        >
          <dl className="divide-y">
            {section.rows.map(([label, value]) => (
              <div
                key={label}
                className="grid grid-cols-[100px_1fr] gap-3 py-3 ps-4 pe-9 text-sm"
              >
                <dt className="text-muted-foreground">{label}</dt>
                <dd className={value ? "" : "text-muted-foreground/60"}>
                  {value || "—"}
                </dd>
              </div>
            ))}
          </dl>
          <Pencil
            className="absolute end-3 top-3 h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground"
            aria-hidden
          />
        </Link>
      ))}
    </div>
  );
}
