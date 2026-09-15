/**
 * Plain CSV building — deliberately has no "server-only" tag, since
 * ExportCsvButton (a client component) needs to build the file in the
 * browser to trigger a download. No library — CSV is simple enough that
 * adding one (this app has none today, see docs/mem) isn't worth it.
 */

/** Escape one cell: wrap in quotes (doubling any inner quotes) whenever it
 *  contains a comma, quote, or newline — otherwise leave it bare. */
function escapeCell(value: string | number): string {
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Build a CSV string from a plain grid of rows. Prefixes a UTF-8 BOM so
 * Hebrew (and other non-ASCII) text renders correctly when the file is
 * opened directly in Excel, which otherwise guesses the wrong encoding.
 */
export function toCsv(rows: (string | number)[][]): string {
  const body = rows.map((row) => row.map(escapeCell).join(",")).join("\r\n");
  return `﻿${body}`;
}
