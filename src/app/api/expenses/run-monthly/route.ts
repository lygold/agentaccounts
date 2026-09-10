import { NextResponse } from "next/server";
import { runMonthlyExpenses } from "@/lib/services/expenses";
import { currentMonth } from "@/lib/expense-schedule";

/**
 * Monthly agent-expense run (Phase 6) — writes the fixed recurring charges
 * (office fee, מדלן, פרמי) into `agent-account`. Idempotent: safe to run
 * daily around the billing date.
 *
 *   curl -X POST https://<host>/api/expenses/run-monthly \
 *        -H "Authorization: Bearer $SYNC_SECRET"
 *
 * Optional `?month=yyyy-mm` to (re)run a specific month; defaults to now.
 */
export async function POST(request: Request) {
  const secret = process.env.SYNC_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "SYNC_SECRET not configured" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const month = new URL(request.url).searchParams.get("month") ?? currentMonth();
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "month must be yyyy-mm" }, { status: 400 });
  }

  try {
    const result = await runMonthlyExpenses(undefined, month);
    console.log("[expenses]", JSON.stringify(result));
    return NextResponse.json(result);
  } catch (e) {
    console.error("[expenses] run-monthly failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
