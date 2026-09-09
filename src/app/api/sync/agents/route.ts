import { NextResponse } from "next/server";
import { syncAgentsFromMonday } from "@/lib/sync/agents";

/**
 * Inbound Daf Kesher → agents sync, for a scheduled trigger (cron / Amplify
 * scheduled function / Upstash QStash). Guarded by a bearer secret:
 *
 *   curl -X POST https://<host>/api/sync/agents \
 *        -H "Authorization: Bearer $SYNC_SECRET"
 *
 * The same job is also a button on /admin/agents.
 */
export async function POST(request: Request) {
  const secret = process.env.SYNC_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "SYNC_SECRET not configured" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncAgentsFromMonday();
    return NextResponse.json(result);
  } catch (e) {
    console.error("[sync] /api/sync/agents failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
