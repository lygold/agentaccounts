import { NextResponse } from "next/server";
import { expireStaleReferrals } from "@/lib/services/referral-expiry";

/**
 * Daily sweep for referrals nobody responded to within the 48-hour window
 * (src/lib/services/referral-expiry.ts) — flips them to declined and
 * notifies the sending agent, so a referral that's never revisited doesn't
 * just sit in "sent" forever with no signal. Same bearer-secret-guarded
 * shape as /api/sync/properties:
 *
 *   curl -X POST https://<host>/api/referrals/expire \
 *        -H "Authorization: Bearer $SYNC_SECRET"
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
    const result = await expireStaleReferrals();
    return NextResponse.json(result);
  } catch (e) {
    console.error("[referrals] /api/referrals/expire failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
