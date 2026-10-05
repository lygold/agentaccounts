"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { syncPropertyDrive } from "@/app/properties/[id]/drive-sync-actions";

interface Strings {
  syncing: string; // {copied} {total}
  synced: string;
  noMatch: string;
  refresh: string;
  failed: string;
}

function fmt(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ""));
}

type State =
  | { kind: "idle" }
  | { kind: "syncing"; copied: number; total: number }
  | { kind: "done"; folderName?: string }
  | { kind: "no_match" }
  | { kind: "error" };

/** Lazy Drive -> storage backfill: on open (when the last sync is stale) and
 *  on demand, pulls new/changed files from the office's Drive folder in
 *  batches, then refreshes the page so the photos appear. */
export function DriveSync({
  propertyId,
  autoRun,
  strings,
}: {
  propertyId: string;
  autoRun: boolean;
  strings: Strings;
}) {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "idle" });
  const running = useRef(false);

  const run = useCallback(
    async (force: boolean) => {
      if (running.current) return;
      running.current = true;
      let totalCopied = 0;
      try {
        setState({ kind: "syncing", copied: 0, total: 0 });
        for (let i = 0; i < 200; i++) {
          const r = await syncPropertyDrive(propertyId, force);
          if (!r.ok) throw new Error(r.error);
          if (r.status === "no_match") return setState({ kind: "no_match" });
          if (r.status === "locked" || r.status === "up_to_date") {
            if (r.status === "up_to_date" && r.total > 0) setState({ kind: "done", folderName: r.folderName });
            else setState({ kind: "idle" });
            break;
          }
          totalCopied += r.copied;
          setState({ kind: "syncing", copied: totalCopied, total: totalCopied + r.remaining });
          if (r.remaining === 0) {
            setState({ kind: "done", folderName: r.folderName });
            break;
          }
        }
        if (totalCopied > 0) router.refresh();
      } catch (e) {
        console.error(e);
        setState({ kind: "error" });
      } finally {
        running.current = false;
      }
    },
    [propertyId, router],
  );

  useEffect(() => {
    if (autoRun) void run(false);
  }, [autoRun, run]);

  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <span role="status">
        {state.kind === "syncing" && fmt(strings.syncing, { copied: state.copied, total: state.total || "…" })}
        {state.kind === "done" && strings.synced}
        {state.kind === "no_match" && strings.noMatch}
        {state.kind === "error" && strings.failed}
      </span>
      <Button type="button" variant="outline" size="sm" disabled={state.kind === "syncing"} onClick={() => void run(true)}>
        {strings.refresh}
      </Button>
    </div>
  );
}
