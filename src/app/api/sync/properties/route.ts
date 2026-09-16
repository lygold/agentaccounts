import { NextResponse } from "next/server";
import { syncPropertiesFromMonday } from "@/lib/sync/properties";

/**
 * Inbound Properties Raw Data → `properties` table sync, for a scheduled
 * trigger (cron / Amplify scheduled function / Upstash QStash) — same
 * shape as /api/sync/agents. Guarded by the same bearer secret:
 *
 *   curl -X POST https://<host>/api/sync/properties \
 *        -H "Authorization: Bearer $SYNC_SECRET"
 *
 * See src/lib/sync/properties.ts's file doc comment for the scope limit
 * (only the fields already reconciled in PROPERTIES_BOARD round-trip).
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
    const result = await syncPropertiesFromMonday();
    return NextResponse.json(result);
  } catch (e) {
    console.error("[sync] /api/sync/properties failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
