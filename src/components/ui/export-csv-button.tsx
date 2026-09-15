"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toCsv } from "@/lib/csv";

/**
 * Downloads a plain grid of rows as a CSV file. `rows` should already
 * include the header row as its first element — callers build the exact
 * grid they want exported (this component has no opinion on columns).
 */
export function ExportCsvButton({
  rows,
  filename,
  label,
}: {
  rows: (string | number)[][];
  filename: string;
  label: string;
}) {
  function handleClick() {
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={handleClick}>
      <Download className="h-4 w-4" aria-hidden />
      {label}
    </Button>
  );
}
