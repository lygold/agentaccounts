import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AlertCircle } from "lucide-react";
import { requireSession, isAdmin } from "@/lib/auth/session-cookie";
import { listAgentsByOffice, compareByTeamThenName } from "@/lib/store/agents";
import { Nav } from "@/components/nav";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { createAgentAction, setAgentStatusAction } from "./actions";
import Link from "next/link";

const ROLES = ["agent", "team_leader", "manager", "admin"] as const;

export default async function AdminAgentsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sort?: string }>;
}) {
  const session = await requireSession();
  if (!isAdmin(session)) redirect("/");
  const [{ error, sort }, agents, t, tRole] = await Promise.all([
    searchParams,
    listAgentsByOffice(session.officeId, { includeArchived: true }),
    getTranslations("Admin"),
    getTranslations("Enums.role"),
  ]);

  const sortBy = sort === "name" ? "name" : "team";
  const order = (list: typeof agents) =>
    sortBy === "name"
      ? [...list].sort((a, b) => a.name.localeCompare(b.name))
      : [...list].sort(compareByTeamThenName);

  const active = order(agents.filter((a) => a.status === "active"));
  const archived = order(agents.filter((a) => a.status === "archived"));

  return (
    <div>
      <Nav />
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="mb-4 text-2xl font-bold">{t("title")}</h1>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" aria-hidden />
            <AlertDescription>{t(`error.${error}`)}</AlertDescription>
          </Alert>
        )}

        <section className="mb-8 rounded-lg border p-4">
          <h2 className="mb-3 font-semibold">{t("addTitle")}</h2>
          <form action={createAgentAction} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">{t("name")}</Label>
              <Input id="name" name="name" required />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="phone">{t("phone")}</Label>
                <Input id="phone" name="phone" type="tel" dir="ltr" />
              </div>
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="email">{t("email")}</Label>
                <Input id="email" name="email" type="email" dir="ltr" />
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="role">{t("role")}</Label>
                <select
                  id="role"
                  name="role"
                  defaultValue="agent"
                  className="h-11 rounded-md border border-input bg-background px-3"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {tRole(r)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex w-28 flex-col gap-1.5">
                <Label htmlFor="team">{t("team")}</Label>
                <Input id="team" name="team" type="number" min="1" />
              </div>
              <label className="flex items-center gap-2 pb-2.5">
                <input type="checkbox" name="isTeamLeader" className="h-4 w-4" />
                <span className="text-sm">{t("isTeamLeader")}</span>
              </label>
            </div>
            <Button type="submit">{t("addSubmit")}</Button>
          </form>
        </section>

        <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
          <span>{t("sortBy")}</span>
          <SortLink active={sortBy === "team"} sort="team" label={t("sortTeam")} />
          <SortLink active={sortBy === "name"} sort="name" label={t("sortName")} />
        </div>

        <AgentTable
          heading={t("activeHeading", { count: active.length })}
          rows={active}
          tRole={tRole}
          t={t}
          canArchive
          selfId={session.agentId}
        />

        {archived.length > 0 && (
          <div className="mt-8">
            <AgentTable
              heading={t("archivedHeading", { count: archived.length })}
              rows={archived}
              tRole={tRole}
              t={t}
              canArchive={false}
              selfId={session.agentId}
            />
          </div>
        )}
      </main>
    </div>
  );
}

function SortLink({
  active,
  sort,
  label,
}: {
  active: boolean;
  sort: string;
  label: string;
}) {
  return (
    <Link
      href={`/admin/agents?sort=${sort}`}
      className={
        active
          ? "font-semibold text-foreground"
          : "underline-offset-4 hover:underline"
      }
    >
      {label}
    </Link>
  );
}

type Row = Awaited<ReturnType<typeof listAgentsByOffice>>[number];

function AgentTable({
  heading,
  rows,
  tRole,
  t,
  canArchive,
  selfId,
}: {
  heading: string;
  rows: Row[];
  tRole: (k: string) => string;
  t: (k: string) => string;
  canArchive: boolean;
  selfId: string;
}) {
  return (
    <section>
      <h2 className="mb-2 font-semibold">{heading}</h2>
      <div className="divide-y overflow-hidden rounded-lg border">
        {rows.length === 0 ? (
          <p className="p-4 text-muted-foreground">{t("empty")}</p>
        ) : (
          rows.map((a) => (
            <div
              key={a.id}
              className={`flex items-center justify-between gap-4 p-4 text-sm ${
                a.status === "archived" ? "opacity-60" : ""
              }`}
            >
              <div className="min-w-0">
                <div className="font-medium">{a.name}</div>
                <div className="truncate text-muted-foreground" dir="ltr">
                  {[a.phone, a.email].filter(Boolean).join(" · ") || "—"}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="text-muted-foreground">
                  {tRole(a.role)}
                  {a.team != null && ` · ${t("teamShort")}${a.team}`}
                </span>
                <Link
                  href={`/admin/agents/${a.id}`}
                  className="underline-offset-4 hover:underline"
                >
                  {t("edit")}
                </Link>
                {canArchive ? (
                  a.id !== selfId && (
                    <form
                      action={setAgentStatusAction.bind(null, a.id, "archived")}
                    >
                      <button
                        type="submit"
                        className="text-destructive underline-offset-4 hover:underline"
                      >
                        {t("archive")}
                      </button>
                    </form>
                  )
                ) : (
                  <form action={setAgentStatusAction.bind(null, a.id, "active")}>
                    <button
                      type="submit"
                      className="text-secondary underline-offset-4 hover:underline"
                    >
                      {t("restore")}
                    </button>
                  </form>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
