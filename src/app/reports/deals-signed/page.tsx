import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireSession, isManager } from "@/lib/auth/session-cookie";
import { listDeals } from "@/lib/store/deals";
import { computeBillingAmount, computeDealValue } from "@/lib/commission";
import { defaultLastMonth, shiftMonth, MONTH_RE } from "@/lib/month";
import { Nav } from "@/components/nav";
import { Button } from "@/components/ui/button";
import { SortableTable, type SortableColumn } from "@/components/ui/sortable-table";
import type { Deal } from "@/lib/types";

interface Row {
  deal: Deal;
  dealValue: number;
  billed: number;
}

export default async function DealsSignedReportPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const session = await requireSession();
  if (!isManager(session)) redirect("/");
  const { month: monthParam } = await searchParams;
  const month = monthParam && MONTH_RE.test(monthParam) ? monthParam : defaultLastMonth();

  const [allDeals, t, tSide, tDealType] = await Promise.all([
    listDeals(session.officeId),
    getTranslations("DealsSignedReport"),
    getTranslations("Enums.side"),
    getTranslations("Enums.dealType"),
  ]);

  const fmt = (n: number) => Math.round(n).toLocaleString();
  const prevMonth = shiftMonth(month, -1);
  const nextMonth = shiftMonth(month, 1);

  const rows: Row[] = allDeals
    .filter((d) => d.stage === "signed" && d.signingDate?.startsWith(month))
    .map((deal) => ({
      deal,
      dealValue: computeDealValue(deal),
      billed: computeBillingAmount(deal),
    }));

  const totals = rows.reduce(
    (acc, r) => ({
      salePrice: acc.salePrice + r.deal.salePrice,
      dealValue: acc.dealValue + r.dealValue,
      billed: acc.billed + r.billed,
    }),
    { salePrice: 0, dealValue: 0, billed: 0 },
  );

  const columns: SortableColumn<Row>[] = [
    {
      key: "signingDate",
      label: t("colSigningDate"),
      sortValue: (r) => r.deal.signingDate ?? "",
      render: (r) => r.deal.signingDate,
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
      key: "side",
      label: t("colSide"),
      sortValue: (r) => r.deal.side,
      render: (r) => tSide(r.deal.side),
      csvValue: (r) => tSide(r.deal.side),
    },
    {
      key: "dealType",
      label: t("colDealType"),
      sortValue: (r) => r.deal.dealType,
      render: (r) => tDealType(r.deal.dealType),
      csvValue: (r) => tDealType(r.deal.dealType),
    },
    {
      key: "salePrice",
      label: t("colSalePrice"),
      align: "end",
      sortValue: (r) => r.deal.salePrice,
      render: (r) => `₪${fmt(r.deal.salePrice)}`,
      csvValue: (r) => r.deal.salePrice,
    },
    {
      key: "commissionPercent",
      label: t("colCommissionPercent"),
      align: "end",
      sortValue: (r) => r.deal.commissionPercent,
      render: (r) => `${r.deal.commissionPercent}%`,
      csvValue: (r) => r.deal.commissionPercent,
    },
    {
      key: "referralPercent",
      label: t("colReferralPercent"),
      align: "end",
      sortValue: (r) => (r.deal.hasReferral ? (r.deal.referralPercent ?? 0) : -1),
      render: (r) => (r.deal.hasReferral ? `${r.deal.referralPercent ?? 0}%` : "—"),
      csvValue: (r) => (r.deal.hasReferral ? (r.deal.referralPercent ?? 0) : ""),
    },
    {
      key: "dealValue",
      label: t("colDealValue"),
      align: "end",
      sortValue: (r) => r.dealValue,
      render: (r) => `₪${fmt(r.dealValue)}`,
      csvValue: (r) => Math.round(r.dealValue),
    },
    {
      key: "billed",
      label: t("colBilled"),
      align: "end",
      sortValue: (r) => r.billed,
      render: (r) => `₪${fmt(r.billed)}`,
      csvValue: (r) => Math.round(r.billed),
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
              <Link href={`/reports/deals-signed?month=${prevMonth}`}>← {t("prevMonth")}</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/reports/deals-signed?month=${nextMonth}`}>{t("nextMonth")} →</Link>
            </Button>
          </div>
        </div>

        <section className="rounded-lg border p-4">
          <SortableTable
            columns={columns}
            rows={rows}
            rowKey={(r) => r.deal.id}
            filename={`deals-signed-${month}`}
            exportLabel={t("exportCsv")}
            emptyLabel={t("empty")}
            footerRow={
              <tr className="border-t-2 font-semibold">
                <td className="p-2" colSpan={6}>
                  {t("total", { count: rows.length })}
                </td>
                <td className="p-2 text-end">₪{fmt(totals.salePrice)}</td>
                <td />
                <td />
                <td className="p-2 text-end">₪{fmt(totals.dealValue)}</td>
                <td className="p-2 text-end">₪{fmt(totals.billed)}</td>
              </tr>
            }
            footerCsvRow={[
              t("total", { count: rows.length }),
              "",
              "",
              "",
              "",
              "",
              Math.round(totals.salePrice),
              "",
              "",
              Math.round(totals.dealValue),
              Math.round(totals.billed),
            ]}
          />
        </section>
      </main>
    </div>
  );
}
