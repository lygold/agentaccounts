import { requireSession } from "@/lib/auth/session-cookie";
import { agentRunningBalance, listLedgerEntriesForAgent } from "@/lib/store/agent-ledger";
import { Nav } from "@/components/nav";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { submitLedgerEntry } from "./actions";

export default async function AgentLedgerPage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  await requireSession();
  const { agentId: rawAgentId } = await params;
  const agentId = decodeURIComponent(rawAgentId);

  const [entries, balance] = await Promise.all([
    listLedgerEntriesForAgent(agentId),
    agentRunningBalance(agentId),
  ]);
  const agentName = entries[0]?.agentName ?? agentId;

  return (
    <div>
      <Nav />
      <main className="mx-auto max-w-2xl p-6">
        <div className="mb-4 flex items-baseline justify-between">
          <h1 className="text-2xl font-bold">{agentName}</h1>
          <span className="text-lg font-semibold">
            ₪{balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
        </div>

        <section className="mb-6 rounded-lg border p-4">
          <h2 className="mb-2 font-semibold">Add entry</h2>
          <form
            action={submitLedgerEntry.bind(null, agentId, agentName)}
            className="flex flex-col gap-3"
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="type">Type</Label>
              <select
                id="type"
                name="type"
                defaultValue="expense"
                className="h-11 rounded-md border border-input bg-background px-3"
              >
                <option value="expense">Expense (office fee, subscription, etc.)</option>
                <option value="payment_to_agent">Payment to agent</option>
                <option value="commission">Commission (manual adjustment)</option>
              </select>
            </div>
            <div className="flex gap-3">
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="amount">Amount (₪)</Label>
                <Input id="amount" name="amount" type="number" step="0.01" required />
              </div>
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="date">Date</Label>
                <Input id="date" name="date" type="date" required />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="description">Description</Label>
              <Input id="description" name="description" required />
            </div>
            <Button type="submit">Add entry</Button>
          </form>
        </section>

        <section className="divide-y overflow-hidden rounded-lg border">
          {entries.length === 0 ? (
            <p className="p-4 text-muted-foreground">No entries yet.</p>
          ) : (
            entries.map((e) => (
              <div key={e.id} className="flex items-center justify-between p-4 text-sm">
                <div>
                  <div className="font-medium">{e.description}</div>
                  <div className="text-muted-foreground">
                    {e.date} · {e.type.replace(/_/g, " ")}
                  </div>
                </div>
                <span className={e.amount >= 0 ? "text-secondary" : "text-destructive"}>
                  {e.amount >= 0 ? "+" : ""}
                  ₪{e.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </div>
            ))
          )}
        </section>
      </main>
    </div>
  );
}
