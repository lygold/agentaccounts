import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AlertCircle } from "lucide-react";
import { requireSession, isAdmin } from "@/lib/auth/session-cookie";
import { listPropertiesByOffice } from "@/lib/store/properties";
import { Nav } from "@/components/nav";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { retryAllMondaySyncAction, retryMondaySyncAction } from "./actions";

/** Admin-only: properties whose push to Monday failed (or never happened).
 *  Agents never see Monday - this page and the menu badge exist for admins. */
export default async function MondaySyncPage() {
  const session = await requireSession();
  if (!isAdmin(session)) redirect("/");
  const t = await getTranslations("MondaySync");

  const all = await listPropertiesByOffice(session.officeId);
  const pending = all
    .filter((p) => !p.mondayItemId || p.mondaySyncError)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const emailConfigured = !!process.env.MAKE_NOTIFICATION_WEBHOOK_URL;

  return (
    <div>
      <Nav />
      <main className="mx-auto max-w-3xl p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          {pending.length > 0 && (
            <form action={retryAllMondaySyncAction}>
              <Button type="submit" variant="outline" size="sm">
                {t("retryAll", { n: pending.length })}
              </Button>
            </form>
          )}
        </div>

        {!emailConfigured && (
          <Alert className="mb-4">
            <AlertDescription className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{t("emailNotConfigured")}</span>
            </AlertDescription>
          </Alert>
        )}

        {pending.length === 0 ? (
          <p className="text-muted-foreground">{t("allGood")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {pending.map((p) => {
              const label = [p.street, p.buildingNumber, p.apartmentNumber ? `דירה ${p.apartmentNumber}` : undefined]
                .filter(Boolean)
                .join(" ");
              return (
                <li key={p.id} className="rounded-lg border p-4 text-sm">
                  <div className="flex items-baseline justify-between gap-2">
                    <Link
                      href={`/properties/${p.id}`}
                      className="font-medium text-secondary underline-offset-4 hover:underline"
                    >
                      {label || p.id}
                    </Link>
                    <span className="text-xs text-muted-foreground">{new Date(p.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{p.agentName}</div>
                  <p className="mt-1 break-words text-xs">
                    {p.mondaySyncError ? (
                      <>
                        {p.mondayItemId ? <strong>{t("partial")} · </strong> : null}
                        {p.mondaySyncError}
                      </>
                    ) : (
                      t("neverPushed")
                    )}
                  </p>
                  <form action={retryMondaySyncAction} className="mt-2">
                    <input type="hidden" name="propertyId" value={p.id} />
                    <Button type="submit" size="sm" variant="outline">
                      {t("retry")}
                    </Button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
