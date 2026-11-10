import type { HistoryPoint } from "@/hooks/usePriceStream";

export interface LinePoint {
  time: number; // unix seconds (UTCTimestamp)
  value: number;
}

/**
 * Lightweight Charts requires strictly ascending, unique times.
 * Sort by time and keep the last value for duplicate timestamps.
 */
export function toLinePoints(points: HistoryPoint[]): LinePoint[] {
  const byTime = new Map<number, number>();
  for (const p of points) {
    byTime.set(Math.floor(p.time), p.value);
  }
  return [...byTime.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([time, value]) => ({ time, value }));
}

/** Convert ISO timestamps from /api/portfolio/history into chart points. */
export function snapshotsToLinePoints(
  snapshots: { total_value: number; recorded_at: string }[],
): LinePoint[] {
  return toLinePoints(
    snapshots.map((s) => ({
      time: Date.parse(s.recorded_at) / 1000,
      value: s.total_value,
    })),
  );
}
