import "server-only";
import { parseBankStatement, dailyBalancesFrom } from "../bank-import";
import {
  insertBankTransaction,
  listBankTransactionsInRange,
  setBankBalance,
} from "../store/bank";

/**
 * Import a pasted bank statement (Phase 7 §2). De-duplicated per office by
 * (date, reference, credit, debit) so re-pasting an overlapping export never
 * doubles a line. Also (re)writes each date's settled end-of-day balance —
 * safe to overwrite, `setBankBalance` is keyed by `${officeId}:${date}`.
 */
export async function importBankStatement(
  officeId: string,
  rawText: string,
): Promise<{ inserted: number; skipped: number; days: number; rows: number }> {
  const rows = parseBankStatement(rawText);
  if (rows.length === 0) return { inserted: 0, skipped: 0, days: 0, rows: 0 };

  const dates = [...new Set(rows.map((r) => r.date))].sort();
  const existing = await listBankTransactionsInRange(
    officeId,
    dates[0],
    dates[dates.length - 1],
  );
  const seen = new Set(existing.map((e) => `${e.date}|${e.reference}|${e.credit}|${e.debit}`));

  let inserted = 0;
  let skipped = 0;
  for (const row of rows) {
    const key = `${row.date}|${row.reference}|${row.credit}|${row.debit}`;
    if (seen.has(key)) {
      skipped++;
      continue;
    }
    await insertBankTransaction({
      officeId,
      date: row.date,
      description: row.description,
      credit: row.credit,
      debit: row.debit,
      reference: row.reference,
      typeCode: row.typeCode,
      balanceAfter: row.balanceAfter,
    });
    seen.add(key);
    inserted++;
  }

  const balances = dailyBalancesFrom(rows);
  for (const [date, balance] of Object.entries(balances)) {
    await setBankBalance(officeId, date, balance);
  }

  return { inserted, skipped, days: Object.keys(balances).length, rows: rows.length };
}
