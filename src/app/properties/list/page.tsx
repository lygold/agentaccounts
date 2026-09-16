import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth/session-cookie";
import { allowedAgentIds, isIdAllowed } from "@/lib/auth/scope";
import { listPropertiesByOffice } from "@/lib/store/properties";
import { Nav } from "@/components/nav";
import { Button } from "@/components/ui/button";
import type { DealType } from "@/lib/types";

type Tab = "all" | DealType;

/** The alternative flat-list view — /properties itself is the Gantt now
 *  (per Levi: "when I click on properties it should show me the gantt not
 *  the list. The list is the alternative view"). Same access shape as
 *  /deals: agent -> own listings, team_leader -> own + team roster,
 *  manager/admin -> everything. */
export default async function PropertiesListPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await requireSession();
  const { tab: rawTab } = await searchParams;
  const tab: Tab = rawTab === "sale" || rawTab === "rental" ? rawTab : "all";

  const [allProperties, allowed, t, tDealType] = await Promise.all([
    listPropertiesByOffice(session.officeId),
    allowedAgentIds(session),
    getTranslations("Properties"),
    getTranslations("Enums.dealType"),
  ]);
  const scoped = allProperties.filter((p) => isIdAllowed(allowed, p.agentId));
  const properties = tab === "all" ? scoped : scoped.filter((p) => p.dealType === tab);

  return (
    <div>
      <Nav />
      <main className="mx-auto max-w-3xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <div className="flex items-center gap-3">
            <Link href="/properties" className="text-sm text-secondary underline-offset-4 hover:underline">
              {t("viewGantt")}
            </Link>
            <Button asChild>
              <Link href="/properties/new">{t("newProperty")}</Link>
            </Button>
          </div>
        </div>
        <div className="mb-4 flex gap-2 text-sm">
          <TabLink tab="all" current={tab} label={t("tabAll")} />
          <TabLink tab="sale" current={tab} label={tDealType("sale")} />
          <TabLink tab="rental" current={tab} label={tDealType("rental")} />
        </div>
        {properties.length === 0 ? (
          <p className="text-muted-foreground">{t("empty")}</p>
        ) : (
          <div className="divide-y overflow-hidden rounded-lg border">
            {properties.map((p) => {
              const address =
                [p.street, p.buildingNumber, p.apartmentNumber ? `דירה ${p.apartmentNumber}` : null]
                  .filter(Boolean)
                  .join(" ") || t("noAddress");
              return (
                <Link
                  key={p.id}
                  href={`/properties/${p.id}`}
                  className="flex items-center justify-between p-4 hover:bg-muted/40"
                >
                  <div>
                    <div className="font-medium">{address}</div>
                    <div className="text-sm text-muted-foreground">
                      {p.agentName}
                      {p.ownerName ? ` · ${p.ownerName}` : ""}
                    </div>
                  </div>
                  <span className="text-sm text-muted-foreground">{tDealType(p.dealType)}</span>
                </Link>
              );
            })}
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
      href={tab === "all" ? "/properties/list" : `/properties/list?tab=${tab}`}
      className={`rounded-full border px-3 py-1 ${
        active ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground"
      }`}
    >
      {label}
    </Link>
  );
}
