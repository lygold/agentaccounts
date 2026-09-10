import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireSession, isManager } from "@/lib/auth/session-cookie";
import { canSeeDeal } from "@/lib/auth/scope";
import { getDeal } from "@/lib/store/deals";
import { listBillingForDeal } from "@/lib/store/billing";
import { listIncomeForDeal, totalReceivedForDeal } from "@/lib/store/income";
import { listLedgerEntriesForAgent, entryExVat } from "@/lib/store/agent-ledger";
import { computeBillingAmount, computeDealValue } from "@/lib/commission";
import type { GreenInvoiceClient } from "@/lib/green-invoice/clients";
import { Nav } from "@/components/nav";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  confirmGreenInvoiceClient,
  createTransactionAccountForDeal,
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
  const session = await requireSession();
  const { id } = await params;
  const { giCandidates, error } = await searchParams;
  const deal = await getDeal(id);
  if (!deal) notFound();
  // Don't leak another agent's deal by direct URL — same scoping as the list.
  if (!(await canSeeDeal(session, deal))) notFound();
  const canEdit = isManager(session);

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

  // Commission is posted automatically as payments come in (see
  // submitIncome / commission-auto.ts). Here we total what's landed on this
  // deal — pre-VAT, since that's what "the agent's commission" means — and
  // show the blended rate it worked out to.
  const agentEntries = await listLedgerEntriesForAgent(deal.agentId);
  const commissionPosted = agentEntries
    .filter((e) => e.dealId === id && e.type === "commission")
    .reduce((sum, e) => sum + entryExVat(e), 0);
  const recognisedSoFar = billed > 0 ? (received / billed) * dealValue : 0;
  const commissionRate = recognisedSoFar > 0 ? commissionPosted / recognisedSoFar : 0;

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

        {canEdit && (
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
        )}

        <section className="rounded-lg border p-4">
          <h2 className="mb-2 font-semibold">{t("incomeTitle")}</h2>
          {incomeRows.length > 0 && (
            <ul className="mb-3 space-y-2 text-sm">
              {incomeRows.map((r) => (
                <li key={r.id} className="flex justify-between border-b pb-2 last:border-0">
                  <span>
                    {r.receivedDate}
                    {r.source === "webhook" && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {t("fromGreenInvoice")}
                      </span>
                    )}
                  </span>
                  <span>₪{r.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </li>
              ))}
            </ul>
          )}
          {canEdit && (
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
          )}
        </section>

        <section className="rounded-lg border p-4">
          <h2 className="mb-2 font-semibold">{t("commissionTitle")}</h2>
          <dl className="grid grid-cols-2 gap-y-1 text-sm">
            <dt className="text-muted-foreground">{t("commissionEffectiveRate")}</dt>
            <dd>{(commissionRate * 100).toFixed(1)}%</dd>
            <dt className="text-muted-foreground">{t("commissionPosted")}</dt>
            <dd>₪{commissionPosted.toLocaleString(undefined, { maximumFractionDigits: 0 })}</dd>
          </dl>
          <p className="mt-2 text-xs text-muted-foreground">{t("commissionAuto")}</p>
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
