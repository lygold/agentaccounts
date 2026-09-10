import "server-only";
import type { AgentRecord } from "./types";

/**
 * Monthly variable-expense bulk import (Yad2, Torah Tidbits, …). One file per
 * vendor: columns agent · date · number (qty) · cost (pre-VAT unit price).
 * The line amount is `qty × cost` pre-VAT. See docs/mem/office-expenses-model.md.
 */

export interface ParsedRow {
  /** 1-based source row for the preview. */
  n: number;
  rawAgent: string;
  date: string; // yyyy-mm-dd
  qty: number;
  unitCost: number;
  /** Matched agent id, or null → needs the manager to pick. */
  agentId: string | null;
  match: "alias" | "exact" | "fuzzy" | "none";
}

export interface ParsedBatch {
  vendor: string;
  rows: ParsedRow[];
}

// --- CSV ---------------------------------------------------------------------

/** Minimal CSV: quoted fields, comma or tab or semicolon delimited. */
function splitCsvLine(line: string, delim: string): string[] {
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

function pickDelimiter(headerLine: string): string {
  for (const d of ["\t", ";", ","]) if (headerLine.includes(d)) return d;
  return ",";
}

const HEADERS = {
  agent: ["agent", "סוכן", "name", "שם"],
  date: ["date", "תאריך"],
  qty: ["number", "qty", "quantity", "כמות", "מספר", "count"],
  cost: ["cost", "price", "מחיר", "עלות", "cost(pre vat)", "cost (pre vat)"],
};

function headerIndex(headers: string[], names: string[]): number {
  const lower = headers.map((h) => h.toLowerCase());
  for (const name of names) {
    const i = lower.indexOf(name);
    if (i !== -1) return i;
  }
  // substring fallback
  for (let i = 0; i < lower.length; i++) {
    if (names.some((name) => lower[i].includes(name))) return i;
  }
  return -1;
}

function toIsoDate(raw: string): string {
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // dd/mm or dd/mm/yy(yy) or dd.mm.yyyy
  const m = s.match(/^(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?$/);
  if (m) {
    const day = m[1].padStart(2, "0");
    const mon = m[2].padStart(2, "0");
    let year = m[3] ?? String(new Date().getFullYear());
    if (year.length === 2) year = `20${year}`;
    return `${year}-${mon}-${day}`;
  }
  return s;
}

// --- agent matching --------------------------------------------------------

function norm(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function matchAgent(
  rawAgent: string,
  agents: AgentRecord[],
  aliases: Record<string, string>,
): { agentId: string | null; match: ParsedRow["match"] } {
  const n = norm(rawAgent);
  if (!n) return { agentId: null, match: "none" };
  if (aliases[n]) return { agentId: aliases[n], match: "alias" };

  for (const a of agents) {
    const names = [
      a.name,
      a.fullNameEnglish,
      a.firstNameHebrew,
      [a.firstNameHebrew, a.surname].filter(Boolean).join(" "),
      [a.fullNameEnglish].filter(Boolean).join(" "),
    ].map(norm);
    if (names.includes(n)) return { agentId: a.id, match: "exact" };
  }

  const [first, ...rest] = n.split(" ");
  const cands = agents.filter((a) => {
    const enFirst = norm(a.fullNameEnglish).split(" ")[0];
    const heFirst = norm(a.firstNameHebrew);
    return (
      (enFirst && (enFirst === first || enFirst.startsWith(first) || first.startsWith(enFirst))) ||
      (heFirst && (heFirst === first || heFirst.startsWith(first)))
    );
  });
  if (cands.length === 1) return { agentId: cands[0].id, match: "fuzzy" };
  if (cands.length > 1 && rest.length) {
    const surnameHint = rest.join(" ");
    const bySurname = cands.filter((a) => {
      const enLast = norm(a.fullNameEnglish).split(" ").slice(1).join(" ");
      return (
        norm(a.surname).startsWith(surnameHint) || (enLast && enLast.startsWith(surnameHint))
      );
    });
    if (bySurname.length === 1) return { agentId: bySurname[0].id, match: "fuzzy" };
  }
  return { agentId: null, match: "none" };
}

// --- parse -----------------------------------------------------------------

export function parseExpenseCsv(
  vendor: string,
  csv: string,
  agents: AgentRecord[],
  aliases: Record<string, string>,
): ParsedBatch {
  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return { vendor, rows: [] };

  const delim = pickDelimiter(lines[0]);
  const headers = splitCsvLine(lines[0], delim);
  const iAgent = headerIndex(headers, HEADERS.agent);
  const iDate = headerIndex(headers, HEADERS.date);
  const iQty = headerIndex(headers, HEADERS.qty);
  const iCost = headerIndex(headers, HEADERS.cost);

  const rows: ParsedRow[] = [];
  for (let r = 1; r < lines.length; r++) {
    const cols = splitCsvLine(lines[r], delim);
    const rawAgent = iAgent >= 0 ? cols[iAgent] ?? "" : cols[0] ?? "";
    if (!rawAgent) continue;
    const qty = Number((iQty >= 0 ? cols[iQty] : "1") || "1") || 1;
    const unitCost = Number((iCost >= 0 ? cols[iCost] : "0") || "0") || 0;
    const date = toIsoDate(iDate >= 0 ? cols[iDate] ?? "" : "");
    const { agentId, match } = matchAgent(rawAgent, agents, aliases);
    rows.push({ n: r, rawAgent, date, qty, unitCost, agentId, match });
  }
  return { vendor, rows };
}
