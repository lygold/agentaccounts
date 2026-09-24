import { redirect } from "next/navigation";
import { requireSession, isManager } from "@/lib/auth/session-cookie";
import { getRedis, RedisKeys } from "@/lib/redis";
import { Nav } from "@/components/nav";

interface StatusEvent {
  kind: "status";
  messageId: string;
  status: string;
  recipient: string;
  errors: Array<{ code: number; title: string; message?: string }> | null;
  metaTimestamp: string;
  receivedAt: string;
}

const STATUS_COLOR: Record<string, string> = {
  read: "text-green-600",
  delivered: "text-green-600",
  sent: "text-muted-foreground",
  failed: "text-destructive",
};

/** Raw feed of Meta's WhatsApp delivery-status callbacks (see
 *  src/app/api/webhooks/whatsapp/route.ts's doc comment for why this
 *  exists — "sent" in our own DB never meant "delivered"). Debugging tool,
 *  not linked from Nav on purpose; manager-gated like /admin/notifications. */
export default async function WhatsAppDebugPage() {
  const session = await requireSession();
  if (!isManager(session)) redirect("/");

  const raw = await getRedis().lrange<StatusEvent>(RedisKeys.whatsappWebhookEvents, 0, 199);
  const events = raw.filter((e): e is StatusEvent => !!e && typeof e === "object" && !!e.messageId);

  return (
    <div>
      <Nav />
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="mb-1 text-2xl font-bold">WhatsApp delivery status</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          Raw status callbacks from Meta — sent/delivered/read/failed, most recent first. Nothing here
          is correlated to a specific referral yet, just the recipient number and message id.
        </p>
        {events.length === 0 ? (
          <p className="text-muted-foreground">
            No events yet — either nothing has been sent since the webhook was configured, or the
            webhook is not set up in Meta Business Manager yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {events.map((e, i) => (
              <li key={i} className="rounded-lg border p-3 text-sm">
                <div className="flex items-baseline justify-between gap-2">
                  <span className={`font-medium ${STATUS_COLOR[e.status] ?? ""}`} dir="ltr">
                    {e.status}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(e.receivedAt).toLocaleString()}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground" dir="ltr">
                  to {e.recipient} · msg {e.messageId}
                </div>
                {e.errors && (
                  <ul className="mt-1 list-inside list-disc text-xs text-destructive">
                    {e.errors.map((err, j) => (
                      <li key={j}>
                        {err.code}: {err.title}
                        {err.message ? ` — ${err.message}` : ""}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
