import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireSession, isManager } from "@/lib/auth/session-cookie";
import { allowedAgentIds, filterDealsByIds } from "@/lib/auth/scope";
import { DEAL_INTAKE_URL } from "@/lib/office";
import { listDeals } from "@/lib/store/deals";
import { Nav } from "@/components/nav";
import { Button } from "@/components/ui/button";

export default async function DealsPage() {
  const session = await requireSession();
  const [allDeals, allowed, t, tStage, tPaymentStatus] = await Promise.all([
    listDeals(),
    allowedAgentIds(session),
    getTranslations("Deals"),
    getTranslations("Enums.stage"),
    getTranslations("Enums.paymentStatus"),
  ]);
  // agent → own deals; team_leader → own + same-team roster; manager/admin → all.
  const deals = filterDealsByIds(allDeals, allowed);

  return (
    <div>
      <Nav />
      <main className="mx-auto max-w-3xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          {isManager(session) ? (
            <Button asChild>
              <Link href="/deals/new">{t("newDeal")}</Link>
            </Button>
          ) : (
            <Button asChild>
              <a href={DEAL_INTAKE_URL} target="_blank" rel="noopener noreferrer">
                {t("newDeal")}
              </a>
            </Button>
          )}
        </div>
        {deals.length === 0 ? (
          <p className="text-muted-foreground">{t("empty")}</p>
        ) : (
          <div className="divide-y overflow-hidden rounded-lg border">
            {deals.map((d) => (
              <Link
                key={d.id}
                href={`/deals/${d.id}`}
                className="flex items-center justify-between p-4 hover:bg-muted/40"
              >
                <div>
                  <div className="font-medium">{d.clientName}</div>
                  <div className="text-sm text-muted-foreground">
                    {d.agentName} · {d.propertyAddress ?? t("noAddress")}
                  </div>
                </div>
                <span className="text-sm text-muted-foreground">
                  {tStage(d.stage)} · {tPaymentStatus(d.paymentStatus)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
