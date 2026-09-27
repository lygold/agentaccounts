import { getTranslations } from "next-intl/server";
import { getAgentById } from "@/lib/store/agents";
import { getReferral } from "@/lib/store/referrals";
import { Button } from "@/components/ui/button";
import { REFERRAL_CONSENT_TEXT_HE } from "@/lib/referral-consent";
import { isReferralExpired, expireReferral } from "@/lib/services/referral-expiry";
import { acceptReferral, declineReferral } from "./actions";

/**
 * Public, unauthenticated referral-response page (Phase 9) — the link the
 * WhatsApp invite opens, replacing the old Fillout form. No session check:
 * the referral id (an opaque UUID) is the only "auth" — deliberate, per
 * Levi ("the receiving agent DOES NOT need to be logged in").
 */
export default async function RespondToReferralPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("ReferralRespond");
  let referral = await getReferral(id);

  if (!referral) {
    return <Shell>{t("notFound")}</Shell>;
  }

  // Lazy backstop, same as the actions' own check: a link opened after the
  // 48h window (before the daily cron has swept it) flips right here
  // rather than showing a still-live invite form for a stale referral.
  if (isReferralExpired(referral)) {
    referral = await expireReferral(referral);
  }

  if (referral.status === "accepted") {
    return (
      <Shell>
        <h1 className="text-xl font-bold">{t("acceptedTitle")}</h1>
        <p className="text-muted-foreground">{t("acceptedBody")}</p>
      </Shell>
    );
  }
  if (referral.status === "declined") {
    // respondedAt set = an explicit decline; null = the 48h window lapsed
    // with no response at all (src/lib/services/referral-expiry.ts) — same
    // status, different message so nobody reads "no response" as "refused".
    const expired = !referral.respondedAt;
    return (
      <Shell>
        <h1 className="text-xl font-bold">{t(expired ? "expiredTitle" : "declinedTitle")}</h1>
        <p className="text-muted-foreground">{t(expired ? "expiredBody" : "declinedBody")}</p>
      </Shell>
    );
  }

  const sendingAgent = await getAgentById(referral.sendingAgentId);

  return (
    <Shell>
      <h1 className="text-xl font-bold">
        {t("inviteTitle", { name: sendingAgent?.name ?? "" })}
      </h1>

      <form action={acceptReferral} className="flex flex-col gap-3">
        <input type="hidden" name="referralId" value={referral.id} />
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="consent" required className="mt-1" />
          <span>{REFERRAL_CONSENT_TEXT_HE}</span>
        </label>
        <Button type="submit" size="lg">
          {t("submit")}
        </Button>
      </form>

      <form action={declineReferral}>
        <input type="hidden" name="referralId" value={referral.id} />
        <button type="submit" className="text-sm text-muted-foreground underline">
          {t("decline")}
        </button>
      </form>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main dir="rtl" className="mx-auto flex max-w-md flex-col gap-6 p-6 pt-16">
      {children}
    </main>
  );
}
