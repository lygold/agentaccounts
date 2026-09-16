import { Fragment } from "react";
import Link from "next/link";
import type { PropertyRecord } from "@/lib/types";
import {
  EXCLUSIVITY_BAND_CLASSES,
  barThicknessPx,
  computeTimelineBounds,
  exclusivityBand,
  monthTicks,
  positionPercent,
  rowGapPx,
} from "@/lib/services/property-gantt";

const LABEL_COL = "8rem";

/** Lightweight custom Gantt — no charting library, per Levi's explicit
 *  preference. A CSS grid keeps the month gridlines pixel-aligned with the
 *  bar tracks (the label column sits in its own grid column, so a
 *  gridline's `left: X%` is always relative to the track column only,
 *  never drifting under the name column). Bar thickness — and the gap
 *  between rows — shrinks as more bars are shown, so a busy manager view
 *  still fits on one page without rows merging into each other. */
export function PropertyGanttChart({
  properties,
  showAgent,
}: {
  properties: (PropertyRecord & { exclusivityStartDate: string; exclusivityEndDate: string })[];
  showAgent: boolean;
}) {
  const now = new Date();
  const bounds = computeTimelineBounds(properties);
  const ticks = monthTicks(bounds);
  const barHeight = barThicknessPx(properties.length);
  const gap = rowGapPx(barHeight);

  const sorted = [...properties].sort(
    (a, b) => new Date(a.exclusivityStartDate).getTime() - new Date(b.exclusivityStartDate).getTime(),
  );

  return (
    <div className="overflow-x-auto rounded-lg border p-3">
      <div
        className="grid items-center"
        style={{ gridTemplateColumns: `${LABEL_COL} 1fr`, columnGap: "0.75rem", rowGap: `${gap}px` }}
      >
        {/* Month gridline labels — row 1, chart column only */}
        <div style={{ gridColumn: 2, gridRow: 1 }} className="relative h-4 text-xs text-muted-foreground">
          {ticks.map((tick, i) => {
            const pct = positionPercent(tick, bounds);
            const isFirst = i === 0;
            const isLast = i === ticks.length - 1;
            return (
              <span
                key={tick}
                className="absolute top-0 whitespace-nowrap"
                style={{
                  left: `${pct}%`,
                  transform: isFirst ? undefined : isLast ? "translateX(-100%)" : "translateX(-50%)",
                }}
                title={new Date(tick).toLocaleDateString("he-IL")}
              >
                {new Date(tick).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit" })}
              </span>
            );
          })}
        </div>

        {/* Vertical lines running down through every bar row, so a date at
         *  the top can be traced straight down to see where each bar
         *  actually starts/ends. */}
        <div
          style={{ gridColumn: 2, gridRow: `2 / span ${sorted.length}` }}
          className="relative"
          aria-hidden
        >
          {ticks.map((tick) => (
            <div
              key={tick}
              className="absolute inset-y-0 w-px bg-border"
              style={{ left: `${positionPercent(tick, bounds)}%` }}
            />
          ))}
        </div>

        {sorted.map((p, i) => {
          const start = positionPercent(new Date(p.exclusivityStartDate).getTime(), bounds);
          const end = positionPercent(new Date(p.exclusivityEndDate).getTime(), bounds);
          const band = exclusivityBand(p.exclusivityStartDate, p.exclusivityEndDate, now);
          const address = [p.street, p.buildingNumber].filter(Boolean).join(" ") || "—";
          const row = i + 2;
          return (
            <Fragment key={p.id}>
              <span
                style={{ gridColumn: 1, gridRow: row }}
                className="truncate text-xs"
                title={`${address}${showAgent ? ` · ${p.agentName}` : ""}`}
              >
                {address}
                {showAgent ? ` · ${p.agentName}` : ""}
              </span>
              <Link
                href={`/properties/${p.id}`}
                style={{ gridColumn: 2, gridRow: row, height: barHeight }}
                className="relative block rounded bg-muted hover:opacity-80"
              >
                <span
                  className={`absolute inset-y-0 rounded ${EXCLUSIVITY_BAND_CLASSES[band]}`}
                  style={{ left: `${start}%`, width: `${Math.max(end - start, 1)}%` }}
                />
              </Link>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
