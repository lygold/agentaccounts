import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth/session-cookie";
import { allowedAgentIds, isIdAllowed } from "@/lib/auth/scope";
import { listOffersByOffice } from "@/lib/store/offers";
import { Nav } from "@/components/nav";
import { Button } from "@/components/ui/button";
import type { OfferStatus } from "@/lib/types";

type Tab = "all" | OfferStatus;
const STATUS_TABS: OfferStatus[] = [
  "new",
  "follow_up",
  "accepted",
  "rejected_too_low",
  "rejected_not_relevant",
  "duplicate",
];

/** Same access shape as /deals and /properties/list: agent -> own offers,
 *  team_leader -> own + team roster, manager/admin -> everything. */
export default async function OffersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await requireSession();
  const { tab: rawTab } = await searchParams;
  const tab: Tab = (STATUS_TABS as string[]).includes(rawTab ?? "") ? (rawTab as OfferStatus) : "all";

  const [allOffers, allowed, t, tStatus] = await Promise.all([
    listOffersByOffice(session.officeId),
    allowedAgentIds(session),
    getTranslations("Offers"),
    getTranslations("Enums.offerStatus"),
  ]);
  const scoped = allOffers.filter((o) => isIdAllowed(allowed, o.agentId));
  const offers = tab === "all" ? scoped : scoped.filter((o) => o.status === tab);

  return (
    <div>
      <Nav />
      <main className="mx-auto max-w-3xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <Button asChild>
            <Link href="/offers/new">{t("newOffer")}</Link>
          </Button>
        </div>
        <div className="mb-4 flex flex-wrap gap-2 text-sm">
          <TabLink tab="all" current={tab} label={t("tabAll")} />
          {STATUS_TABS.map((s) => (
            <TabLink key={s} tab={s} current={tab} label={tStatus(s)} />
          ))}
        </div>
        {offers.length === 0 ? (
          <p className="text-muted-foreground">{t("empty")}</p>
        ) : (
          <div className="divide-y overflow-hidden rounded-lg border">
            {offers.map((o) => (
              <Link
                key={o.id}
                href={`/offers/${o.id}`}
                className="flex items-center justify-between p-4 hover:bg-muted/40"
              >
                <div>
                  <div className="font-medium">{o.propertyAddress}</div>
                  <div className="text-sm text-muted-foreground">
                    {o.buyerName ?? t("awaitingBuyer")}
                    {o.price != null ? ` · ${o.price.toLocaleString()}` : ""}
                  </div>
                </div>
                <span className="text-sm text-muted-foreground">
                  {o.status ? tStatus(o.status) : t("awaitingBuyer")}
                </span>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function TabLink({ tab, current, label }: { tab: Tab; current: Tab; label: string }) {
  const active = tab === current;
  return (
    <Link
      href={tab === "all" ? "/offers" : `/offers?tab=${tab}`}
      className={`rounded-full border px-3 py-1 ${
        active ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground"
      }`}
    >
      {label}
    </Link>
  );
}
