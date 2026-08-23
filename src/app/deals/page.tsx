import Link from "next/link";
import { requireSession } from "@/lib/auth/session-cookie";
import { listDeals } from "@/lib/store/deals";
import { Nav } from "@/components/nav";
import { Button } from "@/components/ui/button";

export default async function DealsPage() {
  await requireSession();
  const deals = await listDeals();

  return (
    <div>
      <Nav />
      <main className="mx-auto max-w-3xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Deals</h1>
          <Button asChild>
            <Link href="/deals/new">New deal</Link>
          </Button>
        </div>
        {deals.length === 0 ? (
          <p className="text-muted-foreground">No deals yet.</p>
        ) : (
          <div className="divide-y overflow-hidden rounded-lg border">
            {deals.map((d) => (
              <Link
                key={d.id}
                href={`/deals/${d.id}`}
                className="flex items-center justify-between p-4 hover:bg-muted/40"
              >
                <div>
                  <div className="font-medium">{d.clientName}</div>
                  <div className="text-sm text-muted-foreground">
                    {d.agentName} · {d.propertyAddress ?? "—"}
                  </div>
                </div>
                <span className="text-sm capitalize text-muted-foreground">
                  {d.stage.replace("_", " ")} · {d.paymentStatus.replace("_", " ")}
                </span>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
