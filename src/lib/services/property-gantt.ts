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

/** Vertical gap (px) between rows — scales with bar thickness so rows never
 *  visually merge into a solid staircase (the first cut's bug: the track
 *  was a fixed 16px regardless of bar thickness, so anything thicker than
 *  that overlapped the row below it). */
export function rowGapPx(barHeight: number): number {
  return Math.max(6, Math.round(barHeight / 2));
}

export interface TimelineBounds {
  startMs: number;
  endMs: number;
}

const PAD_MS_END = 5 * 24 * 60 * 60 * 1000; // a few days of breathing room after the last bar

/**
 * Shared timeline bounds across every bar being shown. Per Levi: "the
 * dates should probably be most left ie start of earliest exclusivity" —
 * the left edge is exactly the earliest start date, no padding. The right
 * edge gets a few days of padding past the latest end date so the last bar
 * isn't flush against the card's edge.
 */
export function computeTimelineBounds(
  items: Array<{ exclusivityStartDate: string; exclusivityEndDate: string }>,
): TimelineBounds {
  const starts = items.map((i) => new Date(i.exclusivityStartDate).getTime());
  const ends = items.map((i) => new Date(i.exclusivityEndDate).getTime());
  return { startMs: Math.min(...starts), endMs: Math.max(...ends) + PAD_MS_END };
}

/** Position (0-100) of a timestamp within the shared timeline. */
export function positionPercent(ms: number, bounds: TimelineBounds): number {
  const span = bounds.endMs - bounds.startMs;
  if (span <= 0) return 0;
  return Math.min(100, Math.max(0, ((ms - bounds.startMs) / span) * 100));
}

/**
 * One tick per calendar month starting exactly at the timeline's left edge
 * — per Levi: "...and then a line every one month after that." Real
 * calendar months (not fixed 30-day chunks), so a tick always lands on the
 * same day-of-month as the start date.
 */
export function monthTicks(bounds: TimelineBounds): number[] {
  const ticks = [bounds.startMs];
  for (let i = 1; ; i++) {
    const next = new Date(bounds.startMs);
    next.setMonth(next.getMonth() + i);
    if (next.getTime() > bounds.endMs) break;
    ticks.push(next.getTime());
  }
  return ticks;
}
