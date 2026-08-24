import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth/session-cookie";
import { listDeals } from "@/lib/store/deals";
import { Nav } from "@/components/nav";
import { Button } from "@/components/ui/button";

export default async function DealsPage() {
  await requireSession();
  const [deals, t, tStage, tPaymentStatus] = await Promise.all([
    listDeals(),
    getTranslations("Deals"),
    getTranslations("Enums.stage"),
    getTranslations("Enums.paymentStatus"),
  ]);

  return (
    <div>
      <Nav />
      <main className="mx-auto max-w-3xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <Button asChild>
            <Link href="/deals/new">{t("newDeal")}</Link>
          </Button>
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
