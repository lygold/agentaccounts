import { getTranslations } from "next-intl/server";
import { CheckCircle2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth/session-cookie";
import { getAgentById } from "@/lib/store/agents";
import { continueAsAgent, endSession } from "./actions";

/** Ported from sikkumPigisha's form/done/page.tsx — unchanged except the
 *  Hebrew-first-name lookup, which comes from agentLedger's own AgentRecord
 *  (session doesn't carry it directly, see wizard-chrome.tsx for the same
 *  adaptation). */
export default async function DonePage({
  searchParams,
}: {
  searchParams: Promise<{ complete?: string }>;
}) {
  const params = await searchParams;
  const complete = params.complete === "1";
  const session = await getSession();
  const agent = session ? await getAgentById(session.agentId) : null;
  const firstName = agent?.firstNameHebrew || session?.agentName.split(/\s+/)[0];
  const t = await getTranslations("DoneStep");

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-8 text-center">
      <h1 className="text-2xl font-bold">
        {firstName ? t("thanksNamed", { name: firstName }) : t("thanksPlain")}
      </h1>
      {complete ? (
        <>
          <CheckCircle2
            className="mx-auto h-16 w-16 text-primary"
            aria-hidden
          />
          <p className="text-sm text-muted-foreground">{t("completeMessage")}</p>
        </>
      ) : (
        <>
          <Info className="mx-auto h-16 w-16 text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">{t("incompleteMessage")}</p>
        </>
      )}

      {session && (
        <form action={continueAsAgent}>
          <Button type="submit" variant="outline" className="w-full">
            {t("continueAsAgent", { name: session.agentName })}
          </Button>
        </form>
      )}

      <form action={endSession}>
        <Button type="submit" variant="ghost" className="w-full">
          {t("done")}
        </Button>
      </form>
    </main>
  );
}
