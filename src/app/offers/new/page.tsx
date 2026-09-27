import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth/session-cookie";
import { listPropertiesByOffice } from "@/lib/store/properties";
import { Nav } from "@/components/nav";
import { OfferNewForm } from "./offer-new-form";

/**
 * Stage 1 of the offers feature: the agent picks one of THEIR OWN
 * properties (strictly agentId === session.agentId — not allowedAgentIds'
 * own+team scope, which is for viewing, not for "whose property is this
 * offer on"), chooses language/logo, and gets a shareable buyer link.
 *
 * Single page, not a multi-step Redis-backed wizard — only 3 inputs, the
 * draft machinery in lib/wizard or lib/property-wizard would be overkill.
 */
export default async function NewOfferPage() {
  const session = await requireSession();
  const t = await getTranslations("OfferNew");

  const allProperties = await listPropertiesByOffice(session.officeId);
  const myProperties = allProperties
    .filter((p) => p.agentId === session.agentId)
    .map((p) => {
      const streetAddress = [p.street, p.buildingNumber].filter(Boolean).join(" ");
      return {
        id: p.id,
        // `||`, not `??` — an empty joined string is still falsy and should
        // fall through to the placeholder, unlike a genuinely-set "".
        address: p.formattedAddress || streetAddress || t("noAddress"),
        ownerName: p.ownerName ?? "",
      };
    });

  return (
    <div>
      <Nav />
      <main className="mx-auto max-w-xl p-6">
        <h1 className="mb-4 text-2xl font-bold">{t("title")}</h1>
        <OfferNewForm properties={myProperties} />
      </main>
    </div>
  );
}
