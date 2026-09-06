import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { isManager, requireSession } from "@/lib/auth/session-cookie";
import { listAgentBalances } from "@/lib/store/agent-ledger";
import { Nav } from "@/components/nav";

export default async function DashboardPage() {
  const session = await requireSession();
  // Office-wide balances are a manager/admin view. Everyone else lands on
  // their own ledger.
  if (!isManager(session)) {
    redirect(`/agents/${encodeURIComponent(session.agentId)}`);
  }
  const [balances, t] = await Promise.all([listAgentBalances(), getTranslations("Dashboard")]);

  return (
    <div>
      <Nav />
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="mb-4 text-2xl font-bold">{t("title")}</h1>
        {balances.length === 0 ? (
          <p className="text-muted-foreground">{t("empty")}</p>
        ) : (
          <div className="divide-y overflow-hidden rounded-lg border">
            {balances.map((b) => (
              <Link
                key={b.agentId}
                href={`/agents/${encodeURIComponent(b.agentId)}`}
                className="flex items-center justify-between p-4 hover:bg-muted/40"
              >
                <span>{b.agentName}</span>
                <span
                  className={
                    b.balance > 0
                      ? "font-semibold text-secondary"
                      : b.balance < 0
                        ? "font-semibold text-destructive"
                        : "text-muted-foreground"
                  }
                >
                  ₪{b.balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
