"use client";

import { useMemo, useState } from "react";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { ExportCsvButton } from "@/components/ui/export-csv-button";

export interface SortableColumn<T> {
  key: string;
  label: string;
  /** Defaults to "start" (left in LTR / right in RTL, matching table text). */
  align?: "start" | "end";
  sortValue: (row: T) => string | number;
  render: (row: T) => React.ReactNode;
  /** Value used for CSV export; defaults to sortValue when omitted. */
  csvValue?: (row: T) => string | number;
}

/**
 * A flat table the user can re-sort by clicking any column header, with a
 * built-in CSV export of whatever's currently sorted — sort and export
 * share state on purpose, so "export what I'm looking at" always holds.
 * Adding another sortable column later is just another `columns` entry.
 */
export function SortableTable<T>({
  columns,
  rows,
  rowKey,
  filename,
  exportLabel,
  footerRow,
  footerCsvRow,
  emptyLabel,
}: {
  columns: SortableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  filename: string;
  exportLabel: string;
  /** Fixed totals row, rendered in <tfoot> — unaffected by sorting. */
  footerRow?: React.ReactNode;
  /** Same totals, as a CSV row appended after the sorted data rows. */
  footerCsvRow?: (string | number)[];
  emptyLabel?: string;
}) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return rows;
    return [...rows].sort((a, b) => {
      const av = col.sortValue(a);
      const bv = col.sortValue(b);
      if (av < bv) return -1 * sort.dir;
      if (av > bv) return 1 * sort.dir;
      return 0;
    });
  }, [rows, sort, columns]);

  function toggleSort(key: string) {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: 1 };
      if (prev.dir === 1) return { key, dir: -1 };
      return null;
    });
  }

  const csvRows = useMemo(() => {
    const header = columns.map((c) => c.label);
    const dataRows = sorted.map((row) =>
      columns.map((c) => (c.csvValue ?? c.sortValue)(row)),
    );
    return footerCsvRow ? [header, ...dataRows, footerCsvRow] : [header, ...dataRows];
  }, [sorted, columns, footerCsvRow]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <ExportCsvButton rows={csvRows} filename={filename} label={exportLabel} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-muted-foreground">
            <tr>
              {columns.map((col) => {
                const active = sort?.key === col.key;
                const Icon = active ? (sort!.dir === 1 ? ArrowUp : ArrowDown) : ArrowUpDown;
                return (
                  <th
                    key={col.key}
                    className={cn(
                      "p-2 font-medium",
                      col.align === "end" ? "text-end" : "text-start",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className={cn(
                        "inline-flex items-center gap-1 hover:text-foreground",
                        active && "text-foreground",
                      )}
                    >
                      {col.label}
                      <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-4 text-center text-muted-foreground">
                  {emptyLabel}
                </td>
              </tr>
            ) : (
              sorted.map((row) => (
                <tr key={rowKey(row)} className="border-t">
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn("p-2", col.align === "end" ? "text-end" : "text-start")}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
          {footerRow && <tfoot>{footerRow}</tfoot>}
        </table>
      </div>
    </div>
  );
}
