import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth/session-cookie";
import { allowedAgentIds, isIdAllowed } from "@/lib/auth/scope";
import { listPropertiesByOffice } from "@/lib/store/properties";
import { Nav } from "@/components/nav";
import { PropertyGanttChart } from "@/components/property-gantt-chart";
import type { DealType, PropertyRecord } from "@/lib/types";

type Tab = "all" | DealType;

function hasExclusivity(
  p: PropertyRecord,
): p is PropertyRecord & { exclusivityStartDate: string; exclusivityEndDate: string } {
  return Boolean(p.exclusivityStartDate && p.exclusivityEndDate);
}

/** Manager and per-agent view are the same route — allowedAgentIds already
 *  encodes "manager sees everyone, agent sees themselves (+ team)", same
 *  scoping /properties and /deals use. Only active listings are shown:
 *  sold/rented/off-market/withdrawn ones aren't "in flight" any more. */
export default async function PropertyGanttPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await requireSession();
  const { tab: rawTab } = await searchParams;
  const tab: Tab = rawTab === "sale" || rawTab === "rental" ? rawTab : "all";

  const [allProperties, allowed, t, tProperties, tDealType] = await Promise.all([
    listPropertiesByOffice(session.officeId),
    allowedAgentIds(session),
    getTranslations("PropertyGantt"),
    getTranslations("Properties"),
    getTranslations("Enums.dealType"),
  ]);

  const visible = allProperties.filter(
    (p) => isIdAllowed(allowed, p.agentId) && p.status === "active",
  );
  const filtered = tab === "all" ? visible : visible.filter((p) => p.dealType === tab);
  const withExclusivity = filtered.filter(hasExclusivity);
  const haskamotOnly = filtered.filter((p) => !hasExclusivity(p));
  const showAgent = allowed === "all";

  return (
    <div>
      <Nav />
      <main className="mx-auto max-w-3xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <Link href="/properties" className="text-sm text-secondary underline-offset-4 hover:underline">
            {t("backToList")}
          </Link>
        </div>

        <div className="mb-4 flex gap-2 text-sm">
          <TabLink tab="all" current={tab} label={tProperties("tabAll")} />
          <TabLink tab="sale" current={tab} label={tDealType("sale")} />
          <TabLink tab="rental" current={tab} label={tDealType("rental")} />
        </div>

        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{t("exclusivitiesTitle")}</h2>
          {withExclusivity.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noExclusivities")}</p>
          ) : (
            <PropertyGanttChart properties={withExclusivity} showAgent={showAgent} />
          )}
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{t("haskamotTitle")}</h2>
          {haskamotOnly.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noHaskamot")}</p>
          ) : (
            <div className="divide-y overflow-hidden rounded-lg border">
              {haskamotOnly.map((p) => {
                const address =
                  [p.street, p.buildingNumber].filter(Boolean).join(" ") || "—";
                return (
                  <Link
                    key={p.id}
                    href={`/properties/${p.id}`}
                    className="flex items-center justify-between p-3 text-sm hover:bg-muted/40"
                  >
                    <div>
                      <div className="font-medium">{address}</div>
                      <div className="text-xs text-muted-foreground">
                        {showAgent ? p.agentName : null}
                        {p.ownerName ? `${showAgent ? " · " : ""}${p.ownerName}` : ""}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">{tDealType(p.dealType)}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function TabLink({ tab, current, label }: { tab: Tab; current: Tab; label: string }) {
  const active = tab === current;
  return (
    <Link
      href={tab === "all" ? "/properties/gantt" : `/properties/gantt?tab=${tab}`}
      className={`rounded-full border px-3 py-1 ${
        active ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground"
      }`}
    >
      {label}
    </Link>
  );
}
