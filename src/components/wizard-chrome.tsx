import { Suspense } from "react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowRight, ArrowLeft, ClipboardCheck } from "lucide-react";
import {
  WIZARD_STEPS,
  WIZARD_FORM_ID,
  WIZARD_DESTINATION_FIELD,
  prevStep,
  stepHref,
  stepIndex,
  type WizardStep,
} from "@/lib/wizard/steps";
import { requireSession } from "@/lib/auth/session-cookie";
import { getAgentById } from "@/lib/store/agents";
import { isRtlLocale, type Locale } from "@/i18n/locales";
import { Button } from "@/components/ui/button";
import { WizardStepError } from "./wizard-step-error";

interface WizardChromeProps {
  step: WizardStep;
  /** Furthest step reached in this draft. When it's "review" and the current
   *  step isn't, show a shortcut back to the summary instead of forcing the
   *  agent through every remaining step again. */
  furthestStep?: WizardStep;
  /** Default "submit" makes the button submit the step's own form (via the
   *  form="..." attribute) before navigating, so in-progress edits aren't
   *  silently dropped. Pass "link" only for steps with no typed/free-text
   *  input to lose — e.g. ChoiceCards steps, where each option is itself the
   *  submit control and a second same-named control would conflict with it. */
  returnToSummaryBehavior?: "submit" | "link";
  children: React.ReactNode;
}

/**
 * Shared chrome for every wizard page: progress bar, step title, back link,
 * greeting. Pages render their form inside `children`.
 *
 * Ported from sikkumPigisha's wizard-chrome.tsx — layout/behavior unchanged.
 * The only real change is the greeting name lookup: sikkumPigisha carried
 * agentFullNameEnglish/agentFirstNameHebrew straight in its session JWT;
 * agentLedger's session only carries the one display name, so this fetches
 * the full AgentRecord (agentId is already in the session either way) to
 * get the English name for the English UI.
 */
export async function WizardChrome({
  step,
  furthestStep,
  returnToSummaryBehavior = "submit",
  children,
}: WizardChromeProps) {
  const t = await getTranslations("WizardChrome");
  const stepTitles = await getTranslations("StepTitles");
  const rawLocale = (await getLocale()) as Locale;
  const rtl = isRtlLocale(rawLocale);
  const session = await requireSession();
  const agent = await getAgentById(session.agentId);
  const agentName = (!rtl && agent?.fullNameEnglish) || session.agentName || "";
  const back = prevStep(step);
  const idx = stepIndex(step);
  const total = WIZARD_STEPS.length;
  const pct = Math.round(((idx + 1) / total) * 100);
  const canReturnToReview = furthestStep === "review" && step !== "review";
  const BackArrow = rtl ? ArrowRight : ArrowLeft;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-6">
      <header className="space-y-3">
        {/* pr-20 (removed again past the sm breakpoint) reserves clearance for
            the fixed top-right LocaleToggle pill, which otherwise overlaps
            whichever span ends up physically on the right — greeting in RTL,
            step-of in LTR — on narrow mobile viewports. */}
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
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <h1 className="text-2xl font-bold">{stepTitles(step)}</h1>
          {back && (
            <Link
              href={stepHref(back)}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              {t("back")}
              <BackArrow className="h-4 w-4" aria-hidden />
            </Link>
          )}
        </div>
      </header>

      {/* Error banner — reads ?error= from the URL on the client so server-
          component pages can redirect here with ?error=save on failure. */}
      <Suspense>
        <WizardStepError />
      </Suspense>

      <main className="flex flex-1 flex-col gap-4">
        {children}
        {canReturnToReview && returnToSummaryBehavior === "submit" && (
          <Button
            type="submit"
            form={WIZARD_FORM_ID}
            name={WIZARD_DESTINATION_FIELD}
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
            <Link href={stepHref("review")}>
              <ClipboardCheck className="h-4 w-4" aria-hidden />
              {t("backToSummary")}
            </Link>
          </Button>
        )}
      </main>
    </div>
  );
}
