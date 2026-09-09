import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AlertCircle } from "lucide-react";
import { requireSession, isAdmin } from "@/lib/auth/session-cookie";
import { getAgentById } from "@/lib/store/agents";
import { Nav } from "@/components/nav";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { updateAgentAction } from "../actions";

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
        <h1 className="mb-4 mt-2 text-2xl font-bold">{agent.name}</h1>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" aria-hidden />
            <AlertDescription>{t(`error.${error}`)}</AlertDescription>
          </Alert>
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
            <Label htmlFor="district">{t("district")}</Label>
            <Input
              id="district"
              name="district"
              type="number"
              min="1"
              defaultValue={agent.district ?? ""}
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
          <Button type="submit" size="lg">
            {t("saveSubmit")}
          </Button>
        </form>
      </main>
    </div>
  );
}
