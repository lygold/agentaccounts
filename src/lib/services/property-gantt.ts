import "server-only";

/**
 * Pure helpers for the exclusivity Gantt view (/properties/gantt). No
 * charting library — Levi's explicit preference for something lightweight
 * (see chat: "I'm keen on lightweight"). Kept dependency-free and testable
 * in isolation from the chart component itself.
 */

export type ExclusivityBand = "green" | "yellow" | "orange" | "red";

/**
 * Color band by % of the exclusivity period elapsed so far. Exact
 * thresholds are Levi's own, verbatim: "a green bar if under 50% of the
 * time (an exclusively is generally 6 months so under 3 months - green)
 * 50-75% yellow 76-90 orange/amber 90+ red." Driven by the contract's own
 * actual start/end dates, not a fixed 6-month assumption — the 6-month
 * example was just his mental model for calibrating the bands.
 */
export function exclusivityBand(
  startDate: string,
  endDate: string,
  now: Date = new Date(),
): ExclusivityBand {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  if (!(end > start)) return "red"; // malformed/inverted dates — flag loudly rather than divide by zero
  const elapsedPercent = ((now.getTime() - start) / (end - start)) * 100;
  if (elapsedPercent < 50) return "green";
  if (elapsedPercent <= 75) return "yellow";
  if (elapsedPercent <= 90) return "orange";
  return "red";
}

export const EXCLUSIVITY_BAND_CLASSES: Record<ExclusivityBand, string> = {
  green: "bg-green-500",
  yellow: "bg-yellow-400",
  orange: "bg-orange-500",
  red: "bg-red-500",
};

/**
 * Bar thickness in px, scaling inversely with how many bars share the
 * chart — per Levi: "if an agent has one biladuit the line can be thick if
 * they have 10 it should shrink a little." Linear falloff from 32px (one
 * bar) down to a 10px floor so bars never disappear on a very busy manager
 * view.
 */
export function barThicknessPx(count: number): number {
  const n = Math.max(count, 1);
  return Math.max(10, 32 - (n - 1) * 2);
}

export interface TimelineBounds {
  startMs: number;
  endMs: number;
}

const PAD_MS = 3 * 24 * 60 * 60 * 1000; // 3 days of breathing room on each edge

/** Shared timeline bounds across every bar being shown, always including
 *  "today" so a chart of only-future or only-past exclusivities still
 *  renders sensibly. */
export function computeTimelineBounds(
  items: Array<{ exclusivityStartDate?: string; exclusivityEndDate?: string }>,
  now: Date = new Date(),
): TimelineBounds {
  const starts = items
    .map((i) => (i.exclusivityStartDate ? new Date(i.exclusivityStartDate).getTime() : null))
    .filter((v): v is number => v != null);
  const ends = items
    .map((i) => (i.exclusivityEndDate ? new Date(i.exclusivityEndDate).getTime() : null))
    .filter((v): v is number => v != null);
  const startMs = Math.min(...starts, now.getTime()) - PAD_MS;
  const endMs = Math.max(...ends, now.getTime()) + PAD_MS;
  return { startMs, endMs };
}

/** Position (0-100) of a timestamp within the shared timeline. */
export function positionPercent(ms: number, bounds: TimelineBounds): number {
  const span = bounds.endMs - bounds.startMs;
  if (span <= 0) return 0;
  return Math.min(100, Math.max(0, ((ms - bounds.startMs) / span) * 100));
}
