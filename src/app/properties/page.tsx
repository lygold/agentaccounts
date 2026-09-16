import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth/session-cookie";
import { allowedAgentIds, isIdAllowed } from "@/lib/auth/scope";
import { listPropertiesByOffice } from "@/lib/store/properties";
import { Nav } from "@/components/nav";
import { Button } from "@/components/ui/button";

/** Same access shape as /deals: agent -> own listings, team_leader -> own +
 *  team roster, manager/admin -> everything (allowedAgentIds already
 *  encodes that scoping — see src/lib/auth/scope.ts). */
export default async function PropertiesPage() {
  const session = await requireSession();
  const [allProperties, allowed, t, tDealType] = await Promise.all([
    listPropertiesByOffice(session.officeId),
    allowedAgentIds(session),
    getTranslations("Properties"),
    getTranslations("Enums.dealType"),
  ]);
  const properties = allProperties.filter((p) => isIdAllowed(allowed, p.agentId));

  return (
    <div>
      <Nav />
      <main className="mx-auto max-w-3xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <Button asChild>
            <Link href="/properties/new">{t("newProperty")}</Link>
          </Button>
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
