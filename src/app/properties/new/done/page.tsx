import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { isAdmin, requireSession } from "@/lib/auth/session-cookie";
import { Nav } from "@/components/nav";
import { Button } from "@/components/ui/button";
import { DriveSync } from "@/components/drive-sync";

export default async function PropertyDonePage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  const session = await requireSession();
  const t = await getTranslations("PropertyDoneStep");
  const td = await getTranslations("PropertyDetail");

  return (
    <div>
      <Nav />
      <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center gap-6 p-8 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-primary" aria-hidden />
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("body")}</p>
        {id && (
          <div className="flex justify-center">
            {/* Backs the new photos up into the office's Drive folder right away.
                Runs for every agent; only admins see its status. */}
            <DriveSync
              propertyId={id}
              autoRun
              visible={isAdmin(session)}
              strings={{
                syncing: td.raw("driveSyncing") as string,
                synced: td("driveSynced"),
                noMatch: td("driveNoMatch"),
                refresh: td("driveRefresh"),
                failed: td("driveFailed"),
              }}
            />
          </div>
        )}
        <div className="flex flex-col gap-3">
          <Button asChild size="lg">
            <Link href="/properties/new">{t("addAnother")}</Link>
          </Button>
          {id && (
            <Button asChild size="lg" variant="outline">
              <Link href={`/properties/${encodeURIComponent(id)}`}>{t("viewProperty")}</Link>
            </Button>
          )}
          <Button asChild size="lg" variant="outline">
            <Link href="/">{t("backHome")}</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
