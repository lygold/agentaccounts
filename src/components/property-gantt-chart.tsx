import Link from "next/link";
import type { PropertyRecord } from "@/lib/types";
import {
  EXCLUSIVITY_BAND_CLASSES,
  barThicknessPx,
  computeTimelineBounds,
  exclusivityBand,
  positionPercent,
} from "@/lib/services/property-gantt";

/** Lightweight custom Gantt — no charting library, per Levi's explicit
 *  preference. Every bar shares one timeline; thickness shrinks as more
 *  bars are shown so a busy manager view still fits on one page. */
export function PropertyGanttChart({
  properties,
  showAgent,
}: {
  properties: (PropertyRecord & { exclusivityStartDate: string; exclusivityEndDate: string })[];
  showAgent: boolean;
}) {
  const now = new Date();
  const bounds = computeTimelineBounds(properties, now);
  const barHeight = barThicknessPx(properties.length);
  const rowGap = Math.max(2, Math.round(barHeight / 4));

  const sorted = [...properties].sort(
    (a, b) => new Date(a.exclusivityStartDate).getTime() - new Date(b.exclusivityStartDate).getTime(),
  );

  return (
    <div className="rounded-lg border p-3">
      <div className="mb-2 flex justify-between text-xs text-muted-foreground">
        <span>{new Date(bounds.startMs).toLocaleDateString("he-IL")}</span>
        <span>{new Date(bounds.endMs).toLocaleDateString("he-IL")}</span>
      </div>
      <div className="flex flex-col" style={{ gap: rowGap }}>
        {sorted.map((p) => {
          const start = positionPercent(new Date(p.exclusivityStartDate).getTime(), bounds);
          const end = positionPercent(new Date(p.exclusivityEndDate).getTime(), bounds);
          const band = exclusivityBand(p.exclusivityStartDate, p.exclusivityEndDate, now);
          const address = [p.street, p.buildingNumber].filter(Boolean).join(" ") || "—";
          return (
            <Link
              key={p.id}
              href={`/properties/${p.id}`}
              className="flex items-center gap-2 text-xs hover:opacity-80"
            >
              <span className="w-32 shrink-0 truncate" title={`${address}${showAgent ? ` · ${p.agentName}` : ""}`}>
                {address}
                {showAgent ? ` · ${p.agentName}` : ""}
              </span>
              <span className="relative h-4 flex-1 rounded bg-muted">
                <span
                  className={`absolute rounded ${EXCLUSIVITY_BAND_CLASSES[band]}`}
                  style={{
                    left: `${start}%`,
                    width: `${Math.max(end - start, 1)}%`,
                    height: barHeight,
                    top: "50%",
                    transform: "translateY(-50%)",
                  }}
                />
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
