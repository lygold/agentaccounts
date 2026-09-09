import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireSession, isManager } from "@/lib/auth/session-cookie";
import { allowedAgentIds, isIdAllowed } from "@/lib/auth/scope";
import { getAgentById } from "@/lib/store/agents";
import { listLedgerEntriesForAgent, runningBalance, entryExVat } from "@/lib/store/agent-ledger";
import { Nav } from "@/components/nav";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { submitLedgerEntry } from "./actions";

export default async function AgentLedgerPage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const session = await requireSession();
  const { agentId: rawAgentId } = await params;
  const agentId = decodeURIComponent(rawAgentId);

  const [agent, entries, allowed, t, tLedgerType] = await Promise.all([
    getAgentById(agentId),
    listLedgerEntriesForAgent(agentId),
    allowedAgentIds(session),
    getTranslations("AgentPage"),
    getTranslations("Enums.ledgerType"),
  ]);
  const balance = runningBalance(entries);
  const balanceExVat = runningBalance(entries, "exVat");
  // Prefer the directory name; fall back to a ledger row, then the id.
  const agentName = agent?.name ?? entries[0]?.agentName ?? agentId;
  // An agent may only open their own ledger; a team leader their team's;
  // manager/admin anyone's.
  const isSelf = agentId === session.agentId;
  if (!isSelf && !isIdAllowed(allowed, agentId)) notFound();
  const canEdit = isManager(session);

  return (
    <div>
      <Nav />
      <main className="mx-auto max-w-2xl p-6">
        <div className="mb-4 flex items-baseline justify-between">
          <h1 className="text-2xl font-bold">{agentName}</h1>
          <div className="text-right">
            <div className="text-lg font-semibold">
              ₪{balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <div className="text-xs text-muted-foreground">
              {t("exVat", {
                amount: balanceExVat.toLocaleString(undefined, { maximumFractionDigits: 0 }),
              })}
            </div>
          </div>
        </div>

        {canEdit && (
        <section className="mb-6 rounded-lg border p-4">
          <h2 className="mb-2 font-semibold">{t("addEntryTitle")}</h2>
          <form
            action={submitLedgerEntry.bind(null, agentId, agentName)}
            className="flex flex-col gap-3"
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="type">{t("type")}</Label>
              <select
                id="type"
                name="type"
                defaultValue="expense"
                className="h-11 rounded-md border border-input bg-background px-3"
              >
                <option value="expense">{t("typeExpense")}</option>
                <option value="payment_to_agent">{t("typePaymentToAgent")}</option>
                <option value="payment_by_agent">{t("typePaymentByAgent")}</option>
                <option value="commission">{t("typeCommission")}</option>
              </select>
            </div>
            <div className="flex gap-3">
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="amount">{t("amount")}</Label>
                <Input id="amount" name="amount" type="number" step="0.01" required />
              </div>
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="date">{t("date")}</Label>
                <Input id="date" name="date" type="date" required />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="description">{t("description")}</Label>
              <Input id="description" name="description" required />
            </div>
            <Button type="submit">{t("submit")}</Button>
          </form>
        </section>
        )}

        <section className="divide-y overflow-hidden rounded-lg border">
          {entries.length === 0 ? (
            <p className="p-4 text-muted-foreground">{t("empty")}</p>
          ) : (
            entries.map((e) => (
              <div key={e.id} className="flex items-center justify-between p-4 text-sm">
                <div>
                  <div className="font-medium">{e.description}</div>
                  <div className="text-muted-foreground">
                    {e.date} · {tLedgerType(e.type)}
                  </div>
                </div>
                <div className="text-right">
                  <div className={e.amount >= 0 ? "text-secondary" : "text-destructive"}>
                    {e.amount >= 0 ? "+" : ""}
                    ₪{e.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t("exVat", {
                      amount: entryExVat(e).toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      }),
                    })}
                  </div>
                </div>
              </div>
            ))
          )}
        </section>
      </main>
    </div>
  );
}
