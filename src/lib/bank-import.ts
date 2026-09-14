import "server-only";

/**
 * Bank Leumi "תנועות בחשבון" export (docs/mem/bank-export-format.md). Paste
 * the data rows from Excel (tab-delimited) — the preamble lines (account /
 * date-range header) are filtered out automatically.
 */

export interface ParsedBankRow {
  n: number;
  date: string; // ISO value date
  credit: number;
  debit: number;
  description: string;
  reference: string;
  typeCode: string;
  /** The export's running balance on this line, when it gave one
   *  (same-day intermediate rows are often blank/0). */
  balanceAfter: number | null;
}

function splitLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function pickDelimiter(line: string): string {
  for (const d of ["\t", ";", ","]) if (line.includes(d)) return d;
  return ",";
}

const HEADERS = {
  balance: ["יתרה", "balance"],
  date: ["תאריך ערך", "value date", "תאריך"],
  credit: ["זכות", "credit"],
  debit: ["חובה", "debit"],
  desc: ["תיאור", "description"],
  ref: ["אסמכתא", "reference"],
  type: ["סוג פעולה", "type"],
};

function headerIndex(headers: string[], names: string[]): number {
  const lower = headers.map((h) => h.trim().toLowerCase());
  for (const name of names) {
    const i = lower.indexOf(name.toLowerCase());
    if (i !== -1) return i;
  }
  return -1;
}

/** Excel's day-0 is 1899-12-30 (the classic off-by-two 1900 leap-year bug). */
function excelSerialToIso(n: number): string {
  const ms = Math.round((n - 25569) * 86_400_000);
  return new Date(ms).toISOString().slice(0, 10);
}

function toIsoDate(raw: string): string {
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})$/);
  if (m) {
    const day = m[1].padStart(2, "0");
    const mon = m[2].padStart(2, "0");
    let year = m[3];
    if (year.length === 2) year = `20${year}`;
    return `${year}-${mon}-${day}`;
  }
  if (/^\d{5}$/.test(s)) return excelSerialToIso(Number(s));
  return s;
}

function num(raw: string | undefined): number {
  if (!raw) return 0;
  const n = Number(raw.replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

/** Finds the header row — the first line whose cells include a recognised
 *  balance/date/credit column, skipping the account-summary preamble lines. */
function findHeaderRow(lines: string[]): number {
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const delim = pickDelimiter(lines[i]);
    const cols = splitLine(lines[i], delim);
    if (headerIndex(cols, HEADERS.date) !== -1 && headerIndex(cols, HEADERS.credit) !== -1) {
      return i;
    }
  }
  return -1;
}

export function parseBankStatement(text: string): ParsedBankRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const headerRow = findHeaderRow(lines);
  if (headerRow === -1) return [];

  const delim = pickDelimiter(lines[headerRow]);
  const headers = splitLine(lines[headerRow], delim);
  const iBal = headerIndex(headers, HEADERS.balance);
  const iDate = headerIndex(headers, HEADERS.date);
  const iCredit = headerIndex(headers, HEADERS.credit);
  const iDebit = headerIndex(headers, HEADERS.debit);
  const iDesc = headerIndex(headers, HEADERS.desc);
  const iRef = headerIndex(headers, HEADERS.ref);
  const iType = headerIndex(headers, HEADERS.type);

  const rows: ParsedBankRow[] = [];
  for (let r = headerRow + 1; r < lines.length; r++) {
    const cols = splitLine(lines[r], delim);
    const date = toIsoDate(iDate >= 0 ? (cols[iDate] ?? "") : "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue; // skip trailing blank/footer rows
    const balRaw = iBal >= 0 ? cols[iBal] : undefined;
    rows.push({
      n: r,
      date,
      credit: num(iCredit >= 0 ? cols[iCredit] : undefined),
      debit: num(iDebit >= 0 ? cols[iDebit] : undefined),
      description: (iDesc >= 0 ? cols[iDesc] : "") || "",
      reference: (iRef >= 0 ? cols[iRef] : "") || "",
      typeCode: (iType >= 0 ? cols[iType] : "") || "",
      balanceAfter: balRaw !== undefined && balRaw !== "" ? num(balRaw) : null,
    });
  }
  return rows;
}

/** The settled balance per date = the LAST row's balance for that date in
 *  file order (Bank Leumi lists same-day rows with 0/blank until the final
 *  one, which carries the real running total — see docs/mem/bank-export-format.md).
 *  Only dates whose last row actually gave a balance are returned. */
export function dailyBalancesFrom(rows: ParsedBankRow[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of rows) {
    if (row.balanceAfter !== null) out[row.date] = row.balanceAfter;
  }
  return out;
}
