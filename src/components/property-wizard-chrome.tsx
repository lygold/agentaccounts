import { Suspense } from "react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowRight, ArrowLeft, ClipboardCheck } from "lucide-react";
import {
  PROPERTY_WIZARD_STEPS,
  PROPERTY_WIZARD_FORM_ID,
  PROPERTY_WIZARD_DESTINATION_FIELD,
  prevPropertyStep,
  propertyStepHref,
  propertyStepIndex,
  type PropertyWizardStep,
} from "@/lib/property-wizard/steps";
import { requireSession } from "@/lib/auth/session-cookie";
import { getAgentById } from "@/lib/store/agents";
import { isRtlLocale, type Locale } from "@/i18n/locales";
import { Button } from "@/components/ui/button";
import { WizardStepError } from "./wizard-step-error";

interface PropertyWizardChromeProps {
  step: PropertyWizardStep;
  furthestStep?: PropertyWizardStep;
  /** See wizard-chrome.tsx's identical prop for the reasoning. */
  returnToSummaryBehavior?: "submit" | "link";
  children: React.ReactNode;
}

/**
 * Shared chrome for the property wizard — deliberately a near-duplicate of
 * src/components/wizard-chrome.tsx (deal wizard) rather than a shared
 * component: same look/behavior, but wired to the property wizard's own
 * step list/i18n namespace, and the two wizards' step sets don't overlap.
 */
export async function PropertyWizardChrome({
  step,
  furthestStep,
  returnToSummaryBehavior = "submit",
  children,
}: PropertyWizardChromeProps) {
  const t = await getTranslations("PropertyWizardChrome");
  const stepTitles = await getTranslations("PropertyStepTitles");
  const rawLocale = (await getLocale()) as Locale;
  const rtl = isRtlLocale(rawLocale);
  const session = await requireSession();
  const agent = await getAgentById(session.agentId);
  const agentName = (!rtl && agent?.fullNameEnglish) || session.agentName || "";
  const back = prevPropertyStep(step);
  const idx = propertyStepIndex(step);
  const total = PROPERTY_WIZARD_STEPS.length;
  const pct = Math.round(((idx + 1) / total) * 100);
  const canReturnToReview = furthestStep === "review" && step !== "review";
  const BackArrow = rtl ? ArrowRight : ArrowLeft;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-6">
      <header className="space-y-3">
        <div className="flex items-center justify-between pr-20 text-xs text-muted-foreground sm:pr-0">
          <span>{t("greeting", { name: agentName })}</span>
          <span>{t("stepOf", { current: idx + 1, total })}</span>
        </div>
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <h1 className="text-2xl font-bold">{stepTitles(step)}</h1>
          {back && (
            <Link
              href={propertyStepHref(back)}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              {t("back")}
              <BackArrow className="h-4 w-4" aria-hidden />
            </Link>
          )}
        </div>
      </header>

      <Suspense>
        <WizardStepError />
      </Suspense>

      <main className="flex flex-1 flex-col gap-4">
        {children}
        {canReturnToReview && returnToSummaryBehavior === "submit" && (
          <Button
            type="submit"
            form={PROPERTY_WIZARD_FORM_ID}
            name={PROPERTY_WIZARD_DESTINATION_FIELD}
            value="review"
            variant="outline"
            size="lg"
          >
            <ClipboardCheck className="h-4 w-4" aria-hidden />
            {t("backToSummary")}
          </Button>
        )}
        {canReturnToReview && returnToSummaryBehavior === "link" && (
          <Button asChild variant="outline" size="lg">
            <Link href={propertyStepHref("review")}>
              <ClipboardCheck className="h-4 w-4" aria-hidden />
              {t("backToSummary")}
            </Link>
          </Button>
        )}
      </main>
    </div>
  );
}
