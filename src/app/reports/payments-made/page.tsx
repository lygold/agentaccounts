import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireSession, isManager } from "@/lib/auth/session-cookie";
import { listDeals } from "@/lib/store/deals";
import { listIncomeForOffice } from "@/lib/store/income";
import { stripVat } from "@/lib/commission";
import { recognisedDealValue } from "@/lib/commission-auto";
import { defaultLastMonth, shiftMonth, MONTH_RE } from "@/lib/month";
import { Nav } from "@/components/nav";
import { Button } from "@/components/ui/button";
import { SortableTable, type SortableColumn } from "@/components/ui/sortable-table";
import type { Deal, Income } from "@/lib/types";

interface Row {
  income: Income;
  deal: Deal;
  exVat: number;
  recognised: number;
}

export default async function PaymentsMadeReportPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const session = await requireSession();
  if (!isManager(session)) redirect("/");
  const { month: monthParam } = await searchParams;
  const month = monthParam && MONTH_RE.test(monthParam) ? monthParam : defaultLastMonth();

  const [allIncome, allDeals, t] = await Promise.all([
    listIncomeForOffice(session.officeId),
    listDeals(session.officeId),
    getTranslations("PaymentsMadeReport"),
  ]);

  const fmt = (n: number) => Math.round(n).toLocaleString();
  const prevMonth = shiftMonth(month, -1);
  const nextMonth = shiftMonth(month, 1);

  const dealsById = new Map(allDeals.map((d) => [d.id, d]));

  const rows: Row[] = allIncome
    .filter((income) => income.receivedDate.startsWith(month))
    .map((income) => {
      const deal = dealsById.get(income.dealId);
      if (!deal) return null;
      return {
        income,
        deal,
        exVat: stripVat(income.amount),
        recognised: recognisedDealValue(deal, income.amount),
      };
    })
    .filter((r): r is Row => r !== null);

  const totals = rows.reduce(
    (acc, r) => ({
      gross: acc.gross + r.income.amount,
      exVat: acc.exVat + r.exVat,
      recognised: acc.recognised + r.recognised,
    }),
    { gross: 0, exVat: 0, recognised: 0 },
  );

  const columns: SortableColumn<Row>[] = [
    {
      key: "receivedDate",
      label: t("colDate"),
      sortValue: (r) => r.income.receivedDate,
      render: (r) => r.income.receivedDate,
    },
    {
      key: "agent",
      label: t("colAgent"),
      sortValue: (r) => r.deal.agentName,
      render: (r) => (
        <Link
          href={`/agents/${encodeURIComponent(r.deal.agentId)}`}
          className="underline-offset-4 hover:underline"
        >
          {r.deal.agentName}
        </Link>
      ),
    },
    {
      key: "client",
      label: t("colClient"),
      sortValue: (r) => r.deal.clientName,
      render: (r) => (
        <Link href={`/deals/${r.deal.id}`} className="underline-offset-4 hover:underline">
          {r.deal.clientName}
        </Link>
      ),
    },
    {
      key: "property",
      label: t("colProperty"),
      sortValue: (r) => r.deal.propertyAddress ?? "",
      render: (r) => r.deal.propertyAddress ?? "—",
    },
    {
      key: "gross",
      label: t("colGross"),
      align: "end",
      sortValue: (r) => r.income.amount,
      render: (r) => `₪${fmt(r.income.amount)}`,
      csvValue: (r) => Math.round(r.income.amount),
    },
    {
      key: "exVat",
      label: t("colExVat"),
      align: "end",
      sortValue: (r) => r.exVat,
      render: (r) => `₪${fmt(r.exVat)}`,
      csvValue: (r) => Math.round(r.exVat),
    },
    {
      key: "recognised",
      label: t("colRecognised"),
      align: "end",
      sortValue: (r) => r.recognised,
      render: (r) => `₪${fmt(r.recognised)}`,
      csvValue: (r) => Math.round(r.recognised),
    },
  ];

  return (
    <div>
      <Nav />
      <main className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">{t("title", { month })}</h1>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/reports/payments-made?month=${prevMonth}`}>← {t("prevMonth")}</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/reports/payments-made?month=${nextMonth}`}>{t("nextMonth")} →</Link>
            </Button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">{t("recognisedNote")}</p>

        <section className="rounded-lg border p-4">
          <SortableTable
            columns={columns}
            rows={rows}
            rowKey={(r) => r.income.id}
            filename={`payments-made-${month}`}
            exportLabel={t("exportCsv")}
            emptyLabel={t("empty")}
            footerRow={
              <tr className="border-t-2 font-semibold">
                <td className="p-2" colSpan={4}>
                  {t("total", { count: rows.length })}
                </td>
                <td className="p-2 text-end">₪{fmt(totals.gross)}</td>
                <td className="p-2 text-end">₪{fmt(totals.exVat)}</td>
                <td className="p-2 text-end">₪{fmt(totals.recognised)}</td>
              </tr>
            }
            footerCsvRow={[
              t("total", { count: rows.length }),
              "",
              "",
              "",
              Math.round(totals.gross),
              Math.round(totals.exVat),
              Math.round(totals.recognised),
            ]}
          />
        </section>
      </main>
    </div>
  );
}
