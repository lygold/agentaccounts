/**
 * `yyyy-mm` helpers for the monthly reports (deals-signed, payments-made).
 * Filtering itself is a plain `date.startsWith(month)` check against each
 * row's own `yyyy-mm-dd` field — no date-range query needed.
 */

export const MONTH_RE = /^\d{4}-\d{2}$/;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** The previous full calendar month, e.g. run on 2026-09-15 -> "2026-08" —
 *  what the end-of-month reports default to (Levi pulls them on the 3rd/4th,
 *  reporting on the month that just closed). */
export function defaultLastMonth(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth(); // 0-based; subtracting 1 from it IS last month
  const d = new Date(Date.UTC(y, m, 1));
  d.setUTCMonth(d.getUTCMonth() - 1);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`;
}

/** Adds `delta` months to a "yyyy-mm" string, handling year rollover. */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`;
}
