import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireSession, isManager } from "@/lib/auth/session-cookie";
import { getRedis, RedisKeys } from "@/lib/redis";
import { Nav } from "@/components/nav";

interface FeedEntry {
  propertyId: string;
  propertyLabel: string;
  at: string;
  authorName: string;
  changes: string[];
  channelsSent: { email: boolean; whatsapp: boolean };
}

/** Aggregated feed of every property-edit notification across the office
 *  — the secretary's one-stop list, separate from each property's own
 *  update thread (see property-notify.ts). Capped at 200 most recent. */
export default async function AdminNotificationsPage() {
  const session = await requireSession();
  if (!isManager(session)) redirect("/");
  const t = await getTranslations("SecretaryFeed");

  // Upstash's client auto-parses JSON list members back into objects (even
  // without an explicit generic) — confirmed live, not raw strings to
  // JSON.parse ourselves. Still guard against a malformed/legacy entry.
  const raw = await getRedis().lrange<FeedEntry>(RedisKeys.secretaryNotifications, 0, 199);
  const entries: FeedEntry[] = raw.filter(
    (e): e is FeedEntry => !!e && typeof e === "object" && Array.isArray(e.changes),
  );

  return (
    <div>
      <Nav />
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="mb-4 text-2xl font-bold">{t("title")}</h1>
        {entries.length === 0 ? (
          <p className="text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {entries.map((e, i) => (
              <li key={i} className="rounded-lg border p-4 text-sm">
                <div className="flex items-baseline justify-between gap-2">
                  <Link
                    href={`/properties/${e.propertyId}`}
                    className="font-medium text-secondary underline-offset-4 hover:underline"
                  >
                    {e.propertyLabel}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {new Date(e.at).toLocaleString()}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">{e.authorName}</div>
                <ul className="mt-1 list-inside list-disc">
                  {e.changes.map((c, j) => (
                    <li key={j}>{c}</li>
                  ))}
                </ul>
                <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
                  {e.channelsSent.email && <span>✓ {t("notifiedEmail")}</span>}
                  {e.channelsSent.whatsapp && <span>✓ {t("notifiedWhatsapp")}</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
