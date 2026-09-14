import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireSession, isAdmin } from "@/lib/auth/session-cookie";
import { listAgentsByOffice, compareByTeamThenName } from "@/lib/store/agents";
import { Nav } from "@/components/nav";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SearchableSelect } from "@/components/ui/searchable-select";
import Link from "next/link";
import {
  addOfficeExpenseAction,
  addRemaxIsraelReceiptAction,
  importBankAction,
} from "./actions";

const CATEGORIES = [
  "cc_fees",
  "municipal",
  "cleaning",
  "pension",
  "loan",
  "ad_vendor",
  "other",
] as const;

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; done?: string; bankDone?: string }>;
}) {
  const session = await requireSession();
  if (!isAdmin(session)) redirect("/");
  const [{ error, done, bankDone }, agents, t, tCat] = await Promise.all([
    searchParams,
    listAgentsByOffice(session.officeId).then((a) => [...a].sort(compareByTeamThenName)),
    getTranslations("Finance"),
    getTranslations("Finance.category"),
  ]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <Nav />
      <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <Button asChild variant="outline" size="sm">
            <Link href={`/reports/daily?date=${today}`}>{t("openReport")}</Link>
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{t(`error.${error}`)}</AlertDescription>
          </Alert>
        )}
        {done === "office" && (
          <Alert>
            <AlertDescription>{t("officeDone")}</AlertDescription>
          </Alert>
        )}
        {done === "remax" && (
          <Alert>
            <AlertDescription>{t("remaxDone")}</AlertDescription>
          </Alert>
        )}
        {bankDone && (
          <Alert>
            <AlertDescription>
              {t("bankDone", {
                inserted: bankDone.split("-")[0] ?? "0",
                skipped: bankDone.split("-")[1] ?? "0",
                days: bankDone.split("-")[2] ?? "0",
              })}
            </AlertDescription>
          </Alert>
        )}

        <section className="rounded-lg border p-4">
          <h2 className="mb-1 font-semibold">{t("bankTitle")}</h2>
          <p className="mb-3 text-sm text-muted-foreground">{t("bankIntro")}</p>
          <form action={importBankAction} className="flex flex-col gap-3">
            <textarea
              name="pasted"
              rows={8}
              dir="ltr"
              className="rounded-md border border-input bg-background p-2 font-mono text-xs"
              placeholder="יתרה\tתאריך ערך\tזכות\tחובה\tתיאור\tאסמכתא\tסוג פעולה"
            />
            <Button type="submit" className="self-start">
              {t("bankImport")}
            </Button>
          </form>
        </section>

        <section className="rounded-lg border p-4">
          <h2 className="mb-3 font-semibold">{t("officeTitle")}</h2>
          <form action={addOfficeExpenseAction} className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="oe-category">{t("category.label")}</Label>
              <select
                id="oe-category"
                name="category"
                defaultValue="other"
                className="h-11 rounded-md border border-input bg-background px-3"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {tCat(c)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="oe-description">{t("description")}</Label>
              <Input id="oe-description" name="description" required className="min-w-[10rem]" />
            </div>
            <div className="flex w-32 flex-col gap-1.5">
              <Label htmlFor="oe-amount">{t("amount")}</Label>
              <Input id="oe-amount" name="amount" type="number" min="0" step="0.01" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="oe-date">{t("date")}</Label>
              <Input id="oe-date" name="date" type="date" defaultValue={today} required />
            </div>
            <Button type="submit" variant="outline">
              {t("add")}
            </Button>
          </form>
        </section>

        <section className="rounded-lg border p-4">
          <h2 className="mb-3 font-semibold">{t("remaxTitle")}</h2>
          <form action={addRemaxIsraelReceiptAction} className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-3">
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="rmi-client">{t("clientName")}</Label>
                <Input id="rmi-client" name="clientName" required className="min-w-[10rem]" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rmi-agent">{t("agent")}</Label>
                <SearchableSelect
                  id="rmi-agent"
                  name="agentId"
                  required
                  placeholder={t("agentPlaceholder")}
                  className="w-48"
                  options={agents.map((a) => ({ value: a.id, label: a.name }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rmi-date">{t("date")}</Label>
                <Input id="rmi-date" name="date" type="date" defaultValue={today} required />
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="flex w-36 flex-col gap-1.5">
                <Label htmlFor="rmi-gross">{t("grossAmount")}</Label>
                <Input id="rmi-gross" name="grossAmount" type="number" min="0" step="0.01" required />
              </div>
              <div className="flex w-36 flex-col gap-1.5">
                <Label htmlFor="rmi-received">{t("receivedAmount")}</Label>
                <Input
                  id="rmi-received"
                  name="receivedAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                />
              </div>
              <div className="flex w-36 flex-col gap-1.5">
                <Label htmlFor="rmi-invoice">{t("invoiceNumber")}</Label>
                <Input id="rmi-invoice" name="invoiceNumber" dir="ltr" required />
              </div>
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="rmi-notes">{t("notes")}</Label>
                <Input id="rmi-notes" name="notes" />
              </div>
            </div>
            <Button type="submit" variant="outline" className="self-start">
              {t("add")}
            </Button>
          </form>
        </section>
      </main>
    </div>
  );
}
