import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth/session-cookie";
import { allowedAgentIds, filterReferralsByIds } from "@/lib/auth/scope";
import { listReferralsByOffice } from "@/lib/store/referrals";
import { listAgentsByOffice } from "@/lib/store/agents";
import { Nav } from "@/components/nav";
import { Button } from "@/components/ui/button";

const AWAITING_RESPONSE_STATUSES = new Set(["new", "sent", "send_failed"]);

/**
 * "Manage my referrals" (Phase 9) — sent-by-me and sent-to-me in one list,
 * same two-sided scoping as filterReferralsByIds. No per-referral detail
 * page yet; the only action from here is finishing a still-pending
 * response via the same public /r/[id] page the WhatsApp invite opens
 * (works whether or not you're logged in).
 */
export default async function ReferralsPage() {
  const session = await requireSession();
  const [allReferrals, allowed, agents, t, tStatus] = await Promise.all([
    listReferralsByOffice(session.officeId),
    allowedAgentIds(session),
    listAgentsByOffice(session.officeId, { includeArchived: true }),
    getTranslations("Referrals"),
    getTranslations("Enums.referralStatus"),
  ]);
  const referrals = filterReferralsByIds(allReferrals, allowed);
  const nameById = new Map(agents.map((a) => [a.id, a.name]));

  return (
    <div>
      <Nav />
      <main className="mx-auto max-w-3xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <Button asChild>
            <Link href="/referrals/new">{t("newReferral")}</Link>
          </Button>
        </div>
        {referrals.length === 0 ? (
          <p className="text-muted-foreground">{t("empty")}</p>
        ) : (
          <div className="divide-y overflow-hidden rounded-lg border">
            {referrals.map((r) => {
              const iAmSender = r.sendingAgentId === session.agentId;
              // External "outgoing" recipients have no receivingAgentId at
              // all (not in our agents table) — fall back to the hand-typed
              // name on the referral itself.
              const counterpartName = iAmSender
                ? (r.receivingAgentId ? nameById.get(r.receivingAgentId) : r.receivingAgentName) ?? "—"
                : nameById.get(r.sendingAgentId) ?? "—";
              // Specifically the receiving agent, not just "not the sender"
              // — a team leader/manager can see a teammate's outgoing
              // referral too, and shouldn't get a "respond" prompt for
              // someone else's (or an external recipient's, who was never
              // an agent in this app to begin with).
              const awaitingMyResponse =
                r.receivingAgentId === session.agentId && AWAITING_RESPONSE_STATUSES.has(r.status);

              return (
                <div key={r.id} className="flex items-center justify-between gap-4 p-4">
                  <div>
                    <div className="font-medium">{r.clientName}</div>
                    <div className="text-sm text-muted-foreground">
                      {iAmSender ? t("toLabel") : t("fromLabel")} {counterpartName}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {awaitingMyResponse ? (
                      <Button asChild size="sm" variant="secondary">
                        <Link href={`/r/${r.id}`}>{t("respond")}</Link>
                      </Button>
                    ) : (
                      <span className="text-sm text-muted-foreground">{tStatus(r.status)}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
