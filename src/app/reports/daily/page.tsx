import { redirect } from "next/navigation";
import { Fragment } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireSession, isManager } from "@/lib/auth/session-cookie";
import { listAgentsByOffice } from "@/lib/store/agents";
import { listLedgerEntriesForOffice } from "@/lib/store/agent-ledger";
import { listDeals } from "@/lib/store/deals";
import { listOfficeExpensesForDate } from "@/lib/store/office-expenses";
import { listBankTransactionsForDate, getBankBalance, getPriorBankBalance } from "@/lib/store/bank";
import { listRemaxIsraelReceiptsForDate } from "@/lib/store/remax-israel-receipts";
import { Nav } from "@/components/nav";
import { Button } from "@/components/ui/button";
import { ExportCsvButton } from "@/components/ui/export-csv-button";

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

export default async function DailyReportPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const session = await requireSession();
  if (!isManager(session)) redirect("/");
  const { date: dateParam } = await searchParams;
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : isoDate(new Date());

  const [agents, allEntries, allDeals, officeExpensesToday, bankToday, balanceToday, balancePrior, remaxToday, t, tPS] =
    await Promise.all([
      listAgentsByOffice(session.officeId, { includeArchived: true }).then((a) =>
        a.filter((x) => x.status !== "archived"),
      ),
      listLedgerEntriesForOffice(session.officeId),
      listDeals(session.officeId),
      listOfficeExpensesForDate(session.officeId, date),
      listBankTransactionsForDate(session.officeId, date),
      getBankBalance(session.officeId, date),
      getPriorBankBalance(session.officeId, date),
      listRemaxIsraelReceiptsForDate(session.officeId, date),
      getTranslations("DailyReport"),
      getTranslations("Enums.paymentStatus"),
    ]);

  const fmt = (n: number) => Math.round(n).toLocaleString();
  const prevDate = isoDate(new Date(new Date(`${date}T00:00:00Z`).getTime() - 86_400_000));
  const nextDate = isoDate(new Date(new Date(`${date}T00:00:00Z`).getTime() + 86_400_000));

  // --- section 1: agents ------------------------------------------------
  const rows = agents
    .map((agent) => {
      const entries = allEntries.filter((e) => e.agentId === agent.id);
      const balance = entries.filter((e) => e.date <= date).reduce((s, e) => s + e.amount, 0);
      const todays = entries.filter((e) => e.date === date);
      const income = todays.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0);
      const expense = todays.filter((e) => e.amount < 0).reduce((s, e) => s + Math.abs(e.amount), 0);
      const outstandingDeals = allDeals.filter(
        (d) => d.agentId === agent.id && (d.paymentStatus === "due" || d.paymentStatus === "partial_payment"),
      );
      return { agent, income, expense, balance, outstandingDeals };
    })
    .sort((a, b) => a.agent.name.localeCompare(b.agent.name));
  const totals = rows.reduce(
    (acc, r) => ({ income: acc.income + r.income, expense: acc.expense + r.expense, balance: acc.balance + r.balance }),
    { income: 0, expense: 0, balance: 0 },
  );

  // --- section 2: bank ----------------------------------------------------
  const debits = bankToday.reduce((s, tx) => s + tx.debit, 0);
  const credits = bankToday.reduce((s, tx) => s + tx.credit, 0);

  const officeExpensesTotal = officeExpensesToday.reduce((s, e) => s + e.amount, 0);

  const agentsCsvRows: (string | number)[][] = [
    [t("colAgent"), t("colIncome"), t("colExpense"), t("colBalance")],
    ...rows.map((r) => [r.agent.name, Math.round(r.income), Math.round(r.expense), Math.round(r.balance)]),
    [t("total"), Math.round(totals.income), Math.round(totals.expense), Math.round(totals.balance)],
  ];
  const remaxCsvRows: (string | number)[][] = [
    [t("colClient"), t("colAgent"), t("colGross"), t("colReceived"), t("colInvoice")],
    ...remaxToday.map((r) => [
      r.clientName,
      r.agentName,
      Math.round(r.grossAmount),
      Math.round(r.receivedAmount),
      r.invoiceNumber,
    ]),
  ];

  return (
    <div>
      <Nav />
      <main className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">{t("title", { date })}</h1>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/reports/daily?date=${prevDate}`}>← {t("prevDay")}</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/reports/daily?date=${nextDate}`}>{t("nextDay")} →</Link>
            </Button>
          </div>
        </div>

        <section className="rounded-lg border p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">{t("agentsTitle")}</h2>
            <ExportCsvButton rows={agentsCsvRows} filename={`daily-agents-${date}`} label={t("exportCsv")} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="p-2">{t("colAgent")}</th>
                  <th className="p-2">{t("colIncome")}</th>
                  <th className="p-2">{t("colExpense")}</th>
                  <th className="p-2">{t("colBalance")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ agent, income, expense, balance, outstandingDeals }) => (
                  <Fragment key={agent.id}>
                    <tr className="border-t">
                      <td className="p-2">
                        <Link
                          href={`/agents/${encodeURIComponent(agent.id)}`}
                          className="underline-offset-4 hover:underline"
                        >
                          {agent.name}
                        </Link>
                      </td>
                      <td className="p-2 text-secondary">{income > 0 ? `₪${fmt(income)}` : "—"}</td>
                      <td className="p-2 text-destructive">{expense > 0 ? `₪${fmt(expense)}` : "—"}</td>
                      <td className={`p-2 font-medium ${balance < 0 ? "text-destructive" : ""}`}>
                        ₪{fmt(balance)}
                      </td>
                    </tr>
                    {outstandingDeals.map((d) => (
                      <tr key={d.id} className="border-t text-xs text-muted-foreground">
                        <td className="p-2 pl-6" colSpan={4}>
                          {t("outstandingDeal", {
                            client: d.clientName,
                            // Filtered to due/partial_payment above, so this
                            // is always set — potential deals (paymentStatus
                            // undefined) never reach outstandingDeals.
                            status: tPS(d.paymentStatus!),
                          })}
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 font-semibold">
                  <td className="p-2">{t("total")}</td>
                  <td className="p-2 text-secondary">₪{fmt(totals.income)}</td>
                  <td className="p-2 text-destructive">₪{fmt(totals.expense)}</td>
                  <td className="p-2">₪{fmt(totals.balance)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        <section className="rounded-lg border p-4">
          <h2 className="mb-3 font-semibold">{t("bankTitle")}</h2>
          <dl className="grid grid-cols-2 gap-y-1 text-sm sm:grid-cols-4">
            <dt className="text-muted-foreground">{t("priorBalance")}</dt>
            <dd>{balancePrior ? `₪${fmt(balancePrior.balance)}` : "—"}</dd>
            <dt className="text-muted-foreground">{t("credits")}</dt>
            <dd className="text-secondary">₪{fmt(credits)}</dd>
            <dt className="text-muted-foreground">{t("debits")}</dt>
            <dd className="text-destructive">₪{fmt(debits)}</dd>
            <dt className="text-muted-foreground">{t("closingBalance")}</dt>
            <dd className="font-medium">{balanceToday ? `₪${fmt(balanceToday.balance)}` : "—"}</dd>
          </dl>
          {officeExpensesToday.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              {t("officeExpensesNote", {
                count: officeExpensesToday.length,
                amount: fmt(officeExpensesTotal),
              })}
            </p>
          )}
          {bankToday.length === 0 && balanceToday === null && (
            <p className="mt-2 text-xs text-muted-foreground">{t("noBankData")}</p>
          )}
        </section>

        <section className="rounded-lg border p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">{t("remaxTitle")}</h2>
            {remaxToday.length > 0 && (
              <ExportCsvButton rows={remaxCsvRows} filename={`daily-remax-${date}`} label={t("exportCsv")} />
            )}
          </div>
          {remaxToday.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("remaxEmpty")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="p-2">{t("colClient")}</th>
                    <th className="p-2">{t("colAgent")}</th>
                    <th className="p-2">{t("colGross")}</th>
                    <th className="p-2">{t("colReceived")}</th>
                    <th className="p-2">{t("colInvoice")}</th>
                  </tr>
                </thead>
                <tbody>
                  {remaxToday.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="p-2">{r.clientName}</td>
                      <td className="p-2">{r.agentName}</td>
                      <td className="p-2">₪{fmt(r.grossAmount)}</td>
                      <td className="p-2">₪{fmt(r.receivedAmount)}</td>
                      <td className="p-2" dir="ltr">
                        {r.invoiceNumber}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
