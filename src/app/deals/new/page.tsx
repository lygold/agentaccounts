import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth/session-cookie";
import { loadDraft, RESUME_PROMPT_AFTER_MS } from "@/lib/wizard/draft";
import { stepHref } from "@/lib/wizard/steps";
import { Button } from "@/components/ui/button";
import { continueDraft, startFreshDraft } from "./resume-actions";

/**
 * /deals/new is now the wizard's landing spot (Phase 8) — it replaces the
 * old manager-only quick form outright, it doesn't sit alongside it.
 * Managers use the same wizard agents do; there is no separate fast path.
 *
 * Bare /deals/new resumes an in-progress draft where the agent left off, or
 * starts a fresh one at the first step — silently, UNLESS the draft has real
 * progress AND hasn't been touched in over an hour (RESUME_PROMPT_AFTER_MS),
 * in which case it asks first rather than dropping them back into a
 * possibly half-forgotten deal (the draft itself survives far longer than
 * that — 12h, tied to the session — so this is purely about not surprising
 * someone who comes back the next day).
 *
 * A brand-new draft (furthestStep still at its default, "language") lands
 * on /deals/new/upload — the AI-extraction offer — rather than jumping
 * straight into the manual steps.
 */
export default async function NewDealEntryPage() {
  const session = await requireSession();
  const draft = await loadDraft(session.agentId);

  const hasProgress = draft.furthestStep !== "language";
  const ageMs = draft.updatedAt ? Date.now() - new Date(draft.updatedAt).getTime() : Infinity;
  const stale = !Number.isFinite(ageMs) || ageMs > RESUME_PROMPT_AFTER_MS;

  if (!hasProgress) {
    redirect("/deals/new/upload");
  }
  if (!stale) {
    redirect(stepHref(draft.furthestStep));
  }

  const t = await getTranslations("ResumeDraftPrompt");
  const locale = await getLocale();
  const lastTouched = draft.updatedAt
    ? new Date(draft.updatedAt).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })
    : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6 text-center">
      <h1 className="text-xl font-bold">{t("title")}</h1>
      <p className="text-sm text-muted-foreground">
        {lastTouched ? t("bodyWithDate", { date: lastTouched }) : t("body")}
      </p>
      <form action={continueDraft}>
        <Button type="submit" size="lg" className="w-full">
          {t("continue")}
        </Button>
      </form>
      <form action={startFreshDraft}>
        <Button type="submit" variant="outline" size="lg" className="w-full">
          {t("startFresh")}
        </Button>
      </form>
    </main>
  );
}
