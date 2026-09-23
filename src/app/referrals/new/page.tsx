import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth/session-cookie";
import { listAgentsByOffice } from "@/lib/store/agents";
import { Nav } from "@/components/nav";
import { NewReferralForm } from "./referral-form";

/**
 * Standalone referral-creation link (Phase 9) — replaces adding a row
 * directly on the Monday "Referrals" board. Any logged-in agent can reach
 * it directly; no approval gate on this side (that's what distinguishes it
 * from the receiving agent's /r/[id] consent step).
 */
export default async function NewReferralPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const t = await getTranslations("ReferralNew");

  const agents = (await listAgentsByOffice(session.officeId)).filter(
    (a) => a.id !== session.agentId,
  );

  return (
    <div>
      <Nav />
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="mb-4 text-2xl font-bold">{t("title")}</h1>
        {params.error === "save" && (
          <p className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {t("errorSave")}
          </p>
        )}
        <NewReferralForm agents={agents} />
      </main>
    </div>
  );
}
