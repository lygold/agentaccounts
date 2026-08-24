import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth/session-cookie";
import { getDeal } from "@/lib/store/deals";
import { listBillingForDeal } from "@/lib/store/billing";
import { listIncomeForDeal, totalReceivedForDeal } from "@/lib/store/income";
import { computeBillingAmount, computeDealValue } from "@/lib/commission";
import { DOCUMENT_TYPE } from "@/lib/green-invoice/documents";
import type { GreenInvoiceClient } from "@/lib/green-invoice/clients";
import { Nav } from "@/components/nav";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  confirmGreenInvoiceClient,
  createReceiptForIncome,
  createTransactionAccountForDeal,
  postCommission,
  searchGreenInvoiceClientForDeal,
  submitIncome,
} from "../actions";

export default async function DealDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ giCandidates?: string; error?: string }>;
}) {
  await requireSession();
  const { id } = await params;
  const { giCandidates, error } = await searchParams;
  const deal = await getDeal(id);
  if (!deal) notFound();

  const [billingRows, incomeRows, received, t, tSide] = await Promise.all([
    listBillingForDeal(id),
    listIncomeForDeal(id),
    totalReceivedForDeal(id),
    getTranslations("DealDetail"),
    getTranslations("Enums.side"),
  ]);
  const billing = billingRows[0];

  const billed = computeBillingAmount(deal);
  const dealValue = computeDealValue(deal);
  const outstanding = billed - received;

  let candidates: GreenInvoiceClient[] = [];
  if (giCandidates) {
    try {
      candidates = JSON.parse(giCandidates);
    } catch {
      candidates = [];
    }
  }

  return (
    <div>
      <Nav />
      <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
        <div>
          <h1 className="text-2xl font-bold">{deal.clientName}</h1>
          <p className="text-muted-foreground">
            {deal.agentName} · {deal.propertyAddress ?? "—"} · {tSide(deal.side)}
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{t("errorBanner")}</AlertDescription>
          </Alert>
        )}

        <section className="rounded-lg border p-4">
          <h2 className="mb-2 font-semibold">{t("figuresTitle")}</h2>
          <dl className="grid grid-cols-2 gap-y-1 text-sm">
            <dt className="text-muted-foreground">{t("salePrice")}</dt>
            <dd>₪{deal.salePrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}</dd>
            <dt className="text-muted-foreground">{t("commission")}</dt>
            <dd>
              {deal.commissionPercent}%
              {deal.hasReferral && deal.referralPercent
                ? t("referralSuffix", { percent: deal.referralPercent })
                : ""}
            </dd>
            <dt className="text-muted-foreground">{t("billed")}</dt>
            <dd>₪{billed.toLocaleString(undefined, { maximumFractionDigits: 0 })}</dd>
            <dt className="text-muted-foreground">{t("receivedSoFar")}</dt>
            <dd>₪{received.toLocaleString(undefined, { maximumFractionDigits: 0 })}</dd>
            <dt className="text-muted-foreground">{t("outstanding")}</dt>
            <dd>₪{outstanding.toLocaleString(undefined, { maximumFractionDigits: 0 })}</dd>
            <dt className="text-muted-foreground">{t("dealValue")}</dt>
            <dd>₪{dealValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</dd>
          </dl>
        </section>

        <section className="rounded-lg border p-4">
          <h2 className="mb-2 font-semibold">{t("greenInvoiceTitle")}</h2>
          {!deal.greenInvoiceClientId ? (
            candidates.length > 0 ? (
              <form action={confirmGreenInvoiceClient.bind(null, deal.id)} className="flex flex-col gap-2">
                <p className="text-sm text-muted-foreground">
                  {t("giMultipleMatch", { clientName: deal.clientName })}
                </p>
                {candidates.map((c) => (
                  <label
                    key={c.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                  >
                    <input type="radio" name="clientChoice" value={c.id} className="h-4 w-4" required />
                    <span>
                      {c.name} {c.emails?.[0] ? `· ${c.emails[0]}` : ""}
                    </span>
                  </label>
                ))}
                <label className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                  <input type="radio" name="clientChoice" value="new" className="h-4 w-4" required />
                  <span>{t("giCreateNew")}</span>
                </label>
                <Button type="submit" className="mt-2">
                  {t("giConfirm")}
                </Button>
              </form>
            ) : (
              <form action={searchGreenInvoiceClientForDeal.bind(null, deal.id)}>
                <p className="mb-3 text-sm text-muted-foreground">{t("giNoneLinked")}</p>
                <Button type="submit">{t("giFindOrCreate")}</Button>
              </form>
            )
          ) : !billing?.greenInvoiceRef ? (
            <form action={createTransactionAccountForDeal.bind(null, deal.id)}>
              <p className="mb-3 text-sm text-muted-foreground">{t("giReadyFor300")}</p>
              <Button type="submit">{t("giCreate300")}</Button>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("giCreated300", { ref: billing.greenInvoiceRef })}
            </p>
          )}
        </section>

        <section className="rounded-lg border p-4">
          <h2 className="mb-2 font-semibold">{t("incomeTitle")}</h2>
          {incomeRows.length > 0 && (
            <ul className="mb-3 space-y-2 text-sm">
              {incomeRows.map((r) => (
                <li key={r.id} className="flex flex-col gap-1 border-b pb-2 last:border-0">
                  <div className="flex justify-between">
                    <span>{r.receivedDate}</span>
                    <span>₪{r.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                  </div>
                  {r.greenInvoiceReceiptRef ? (
                    <span className="text-xs text-muted-foreground">
                      {t("receiptCreated", { ref: r.greenInvoiceReceiptRef })}
                    </span>
                  ) : (
                    billing?.greenInvoiceRef && (
                      <form
                        action={createReceiptForIncome.bind(null, deal.id, r.id)}
                        className="flex items-center gap-2"
                      >
                        <select
                          name="documentType"
                          defaultValue={DOCUMENT_TYPE.taxInvoiceReceipt}
                          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                        >
                          <option value={DOCUMENT_TYPE.taxInvoice}>חשבונית מס</option>
                          <option value={DOCUMENT_TYPE.taxInvoiceReceipt}>חשבונית מס / קבלה</option>
                          <option value={DOCUMENT_TYPE.receipt}>קבלה</option>
                        </select>
                        <Button type="submit" size="sm">
                          {t("createReceipt")}
                        </Button>
                      </form>
                    )
                  )}
                </li>
              ))}
            </ul>
          )}
          <form action={submitIncome.bind(null, deal.id)} className="flex flex-col gap-3">
            <div className="flex gap-3">
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="amount">{t("amount")}</Label>
                <Input id="amount" name="amount" type="number" required />
              </div>
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="receivedDate">{t("dateReceived")}</Label>
                <Input id="receivedDate" name="receivedDate" type="date" required />
              </div>
            </div>
            <Button type="submit">{t("logPayment")}</Button>
          </form>
        </section>

        <section className="rounded-lg border p-4">
          <h2 className="mb-2 font-semibold">{t("postCommissionTitle")}</h2>
          <p className="mb-3 text-sm text-muted-foreground">
            {t("postCommissionDescription", { agentName: deal.agentName })}
          </p>
          <form action={postCommission.bind(null, deal.id)} className="flex items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="agentRate">{t("agentRate")}</Label>
              <Input id="agentRate" name="agentRate" type="number" step="0.01" defaultValue="0.5" required />
            </div>
            <Button type="submit">{t("postCommission")}</Button>
          </form>
        </section>

        {billingRows.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {t("billingCreatedOn", { date: new Date(billingRows[0].createdAt).toLocaleDateString() })}
          </p>
        )}
      </main>
    </div>
  );
}
