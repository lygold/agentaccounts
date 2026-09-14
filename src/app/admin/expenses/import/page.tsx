import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireSession, isAdmin } from "@/lib/auth/session-cookie";
import { getRedis, RedisKeys } from "@/lib/redis";
import { listAgentsByOffice, compareByTeamThenName } from "@/lib/store/agents";
import type { ParsedBatch } from "@/lib/expense-import";
import { Nav } from "@/components/nav";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { commitImportAction, parseUploadAction } from "./actions";

export default async function ExpenseImportPage({
  searchParams,
}: {
  searchParams: Promise<{ batch?: string; error?: string; done?: string }>;
}) {
  const session = await requireSession();
  if (!isAdmin(session)) redirect("/");
  const [{ batch: token, error, done }, t] = await Promise.all([
    searchParams,
    getTranslations("ExpenseImport"),
  ]);

  const agents = (await listAgentsByOffice(session.officeId, { includeArchived: true }))
    .filter((a) => a.status !== "archived")
    .sort(compareByTeamThenName);

  let batch: ParsedBatch | null = null;
  if (token) {
    const raw = await getRedis()
      .get<ParsedBatch | string>(RedisKeys.expenseImportBatch(token))
      .catch(() => null);
    if (raw) batch = typeof raw === "string" ? JSON.parse(raw) : raw;
  }

  return (
    <div>
      <Nav />
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="mb-4 text-2xl font-bold">{t("title")}</h1>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{t(`error.${error}`)}</AlertDescription>
          </Alert>
        )}
        {done && (
          <Alert className="mb-4">
            <AlertDescription>
              {t("done", {
                created: done.split("-")[0] ?? "0",
                skipped: done.split("-")[1] ?? "0",
              })}
            </AlertDescription>
          </Alert>
        )}

        {!batch ? (
          <form action={parseUploadAction} className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">{t("intro")}</p>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="vendor">{t("vendor")}</Label>
              <Input id="vendor" name="vendor" placeholder="Yad2" required className="w-56" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pasted">{t("paste")}</Label>
              <textarea
                id="pasted"
                name="pasted"
                rows={8}
                dir="ltr"
                className="rounded-md border border-input bg-background p-2 font-mono text-xs"
                placeholder={"agent\tdate\tnumber\tcost\nmicha\t2/9\t2\t100"}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="file">{t("orFile")}</Label>
              <input id="file" name="file" type="file" accept=".csv,text/csv,text/plain" />
            </div>
            <Button type="submit" className="self-start">
              {t("parse")}
            </Button>
          </form>
        ) : (
          <form action={commitImportAction.bind(null, token!)} className="flex flex-col gap-4">
            <p className="text-sm">
              {t("previewHead", {
                vendor: batch.vendor,
                rows: batch.rows.length,
                unmatched: batch.rows.filter((r) => !r.agentId).length,
              })}
            </p>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="p-2">{t("colRaw")}</th>
                    <th className="p-2">{t("colDate")}</th>
                    <th className="p-2">{t("colQty")}</th>
                    <th className="p-2">{t("colCost")}</th>
                    <th className="p-2">{t("colTotal")}</th>
                    <th className="p-2">{t("colAgent")}</th>
                  </tr>
                </thead>
                <tbody>
                  {batch.rows.map((r) => (
                    <tr key={r.n} className={r.agentId ? "border-t" : "border-t bg-destructive/10"}>
                      <td className="p-2" dir="ltr">{r.rawAgent}</td>
                      <td className="p-2" dir="ltr">{r.date}</td>
                      <td className="p-2">{r.qty}</td>
                      <td className="p-2">₪{r.unitCost}</td>
                      <td className="p-2">₪{(r.qty * r.unitCost).toLocaleString()}</td>
                      <td className="p-2">
                        <SearchableSelect
                          name={`agent_${r.n}`}
                          defaultValue={r.agentId ?? ""}
                          placeholder={t("skipRow")}
                          className="h-9 max-w-[12rem] px-2 text-sm"
                          options={[
                            { value: "", label: t("skipRow") },
                            ...agents.map((a) => ({
                              value: a.id,
                              label: a.name,
                              hint: a.team != null ? String(a.team) : undefined,
                            })),
                          ]}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-3">
              <Button type="submit">{t("commit")}</Button>
              <Button asChild variant="outline">
                <a href="/admin/expenses/import">{t("cancel")}</a>
              </Button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
