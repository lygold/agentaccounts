import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AlertCircle } from "lucide-react";
import { requireSession, isAdmin } from "@/lib/auth/session-cookie";
import { getAgentById } from "@/lib/store/agents";
import { listRecurringExpensesForAgent } from "@/lib/store/recurring-expenses";
import { isChargeableInMonth, currentMonth } from "@/lib/expense-schedule";
import { Nav } from "@/components/nav";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  addRecurringExpenseAction,
  toggleRecurringExpenseAction,
  updateAgentAction,
} from "../actions";

const ROLES = ["agent", "team_leader", "manager", "admin"] as const;

export default async function EditAgentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireSession();
  if (!isAdmin(session)) redirect("/");
  const [{ id }, { error }, t, tRole] = await Promise.all([
    params,
    searchParams,
    getTranslations("Admin"),
    getTranslations("Enums.role"),
  ]);

  const agent = await getAgentById(id);
  if (!agent || agent.officeId !== session.officeId) notFound();

  const recurring = await listRecurringExpensesForAgent(id);
  const chargingNow = isChargeableInMonth(agent.expenseChargeDate, currentMonth());

  return (
    <div>
      <Nav />
      <main className="mx-auto max-w-lg p-6">
        <Link
          href="/admin/agents"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          ← {t("title")}
        </Link>
        <h1 className="mb-4 mt-2 flex items-baseline gap-2 text-2xl font-bold">
          {agent.name}
          <span className="text-sm font-normal text-muted-foreground">
            {t(`status.${agent.status}`)}
          </span>
        </h1>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" aria-hidden />
            <AlertDescription>{t(`error.${error}`)}</AlertDescription>
          </Alert>
        )}

        {(agent.commissionTier != null ||
          agent.yad2Number ||
          agent.madlanNumber) && (
          <dl className="mb-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-lg border p-3 text-sm">
            {agent.commissionTier != null && (
              <>
                <dt className="text-muted-foreground">{t("commissionTier")}</dt>
                <dd>{agent.commissionTier}%</dd>
              </>
            )}
            {agent.yad2Number && (
              <>
                <dt className="text-muted-foreground">Yad2</dt>
                <dd dir="ltr">{agent.yad2Number}</dd>
              </>
            )}
            {agent.madlanNumber && (
              <>
                <dt className="text-muted-foreground">Madlan</dt>
                <dd dir="ltr">{agent.madlanNumber}</dd>
              </>
            )}
          </dl>
        )}

        <form
          action={updateAgentAction.bind(null, agent.id)}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">{t("name")}</Label>
            <Input id="name" name="name" defaultValue={agent.name} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phone">{t("phone")}</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              dir="ltr"
              defaultValue={agent.phone ?? ""}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">{t("email")}</Label>
            <Input
              id="email"
              name="email"
              type="email"
              dir="ltr"
              defaultValue={agent.email ?? ""}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="role">{t("role")}</Label>
            <select
              id="role"
              name="role"
              defaultValue={agent.role}
              className="h-11 rounded-md border border-input bg-background px-3"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {tRole(r)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="team">{t("team")}</Label>
            <Input
              id="team"
              name="team"
              type="number"
              min="1"
              defaultValue={agent.team ?? ""}
            />
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="isTeamLeader"
              defaultChecked={agent.isTeamLeader}
              className="h-4 w-4"
            />
            <span className="text-sm">{t("isTeamLeader")}</span>
          </label>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="fullNameEnglish">{t("fullNameEnglish")}</Label>
              <Input
                id="fullNameEnglish"
                name="fullNameEnglish"
                dir="ltr"
                defaultValue={agent.fullNameEnglish ?? ""}
              />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="firstNameHebrew">{t("firstNameHebrew")}</Label>
              <Input
                id="firstNameHebrew"
                name="firstNameHebrew"
                defaultValue={agent.firstNameHebrew ?? ""}
              />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="surname">{t("surname")}</Label>
              <Input
                id="surname"
                name="surname"
                defaultValue={agent.surname ?? ""}
              />
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="licenseNumber">{t("licenseNumber")}</Label>
              <Input
                id="licenseNumber"
                name="licenseNumber"
                dir="ltr"
                defaultValue={agent.licenseNumber ?? ""}
              />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="expenseChargeDate">{t("expenseChargeDate")}</Label>
              <Input
                id="expenseChargeDate"
                name="expenseChargeDate"
                type="date"
                defaultValue={agent.expenseChargeDate ?? ""}
              />
            </div>
            <div className="flex w-32 flex-col gap-1.5">
              <Label htmlFor="officeFeeExVat">{t("officeFeeExVat")}</Label>
              <Input
                id="officeFeeExVat"
                name="officeFeeExVat"
                type="number"
                min="0"
                step="1"
                defaultValue={agent.officeFeeExVat ?? ""}
              />
            </div>
          </div>

          <Button type="submit" size="lg">
            {t("saveSubmit")}
          </Button>
        </form>

        <section className="mt-8 rounded-lg border p-4">
          <h2 className="mb-1 font-semibold">{t("recurringTitle")}</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            {chargingNow
              ? t("recurringChargingNow")
              : t("recurringFrom", {
                  date: agent.expenseChargeDate ?? "—",
                })}
          </p>
          <div className="mb-4 divide-y rounded-md border">
            {recurring.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">{t("recurringEmpty")}</p>
            ) : (
              recurring.map((r) => (
                <div
                  key={r.id}
                  className={`flex items-center justify-between gap-3 p-3 text-sm ${
                    r.active ? "" : "opacity-50"
                  }`}
                >
                  <span>{r.label}</span>
                  <span className="flex items-center gap-3">
                    <span>{t("recurringRowAmount", { amount: r.amountExVat.toLocaleString() })}</span>
                    <form action={toggleRecurringExpenseAction.bind(null, agent.id, r.id)}>
                      <button
                        type="submit"
                        className="text-xs underline-offset-4 hover:underline"
                      >
                        {r.active ? t("recurringPause") : t("recurringResume")}
                      </button>
                    </form>
                  </span>
                </div>
              ))
            )}
          </div>
          <form
            action={addRecurringExpenseAction.bind(null, agent.id)}
            className="flex flex-wrap items-end gap-3"
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="label">{t("recurringLabel")}</Label>
              <Input id="label" name="label" className="w-40" required />
            </div>
            <div className="flex w-32 flex-col gap-1.5">
              <Label htmlFor="amountExVat">{t("recurringAmount")}</Label>
              <Input
                id="amountExVat"
                name="amountExVat"
                type="number"
                min="1"
                step="1"
                required
              />
            </div>
            <Button type="submit" variant="outline" size="sm">
              {t("recurringAdd")}
            </Button>
          </form>
        </section>
      </main>
    </div>
  );
}
