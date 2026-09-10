/**
 * When an agent's monthly expenses start, from `AgentRecord.expenseChargeDate`
 * (Daf Kesher "Charge Date", column `date_mkqxg29d`).
 *
 * Rule (Levi, 2026-09-10): **no partial months.**
 *  - blank / not a date  → the charge date is well in the past → chargeable now
 *  - a past charge date   → chargeable now
 *  - the 1st of a month   → that month
 *  - mid-month            → round UP to the next full month
 *
 * `month` is "yyyy-mm". Used by the monthly agent-expense job (Phase 6).
 */
export function isChargeableInMonth(
  expenseChargeDate: string | null | undefined,
  month: string,
): boolean {
  if (!expenseChargeDate || !/^\d{4}-\d{2}-\d{2}$/.test(expenseChargeDate)) {
    return true;
  }
  const [y, m, d] = expenseChargeDate.split("-").map(Number);
  let startYear = y;
  let startMonth = m;
  if (d > 1) {
    startMonth += 1;
    if (startMonth > 12) {
      startMonth = 1;
      startYear += 1;
    }
  }
  const start = `${startYear}-${String(startMonth).padStart(2, "0")}`;
  return month >= start;
}

/** Current month as "yyyy-mm". */
export function currentMonth(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
