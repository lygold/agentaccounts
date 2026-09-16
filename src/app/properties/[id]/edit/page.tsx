import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireSession, isManager } from "@/lib/auth/session-cookie";
import { allowedAgentIds, isIdAllowed } from "@/lib/auth/scope";
import { getProperty } from "@/lib/store/properties";
import { Nav } from "@/components/nav";
import { EditPropertyForm } from "./edit-form";

/** Any field can be edited by the owning agent or a manager — not gated
 *  further (per Levi: edits save immediately, the secretary gets notified
 *  afterward rather than approving first). See property-notify.ts for the
 *  notification side. */
export default async function EditPropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  const property = await getProperty(id);
  if (!property || property.officeId !== session.officeId) notFound();

  const allowed = await allowedAgentIds(session);
  if (!isIdAllowed(allowed, property.agentId)) notFound();
  if (property.agentId !== session.agentId && !isManager(session)) {
    redirect(`/properties/${id}`);
  }

  const t = await getTranslations("PropertyEdit");

  return (
    <div>
      <Nav />
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="mb-4 text-2xl font-bold">{t("title")}</h1>
        <EditPropertyForm property={property} />
      </main>
    </div>
  );
}
