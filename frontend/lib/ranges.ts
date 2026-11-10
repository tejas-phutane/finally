/** Time ranges offered in the main chart. Keys match the backend RANGES map. */
export const RANGE_KEYS = ["1D", "5D", "1M", "3M", "6M", "1Y", "5Y"] as const;
export type RangeKey = (typeof RANGE_KEYS)[number];

/** Chart drawing styles for the main chart. */
export const CHART_STYLES = ["candle", "bar", "line", "area"] as const;
export type ChartStyle = (typeof CHART_STYLES)[number];

const BAR_SECONDS: Record<string, number> = {
  "1m": 60,
  "5m": 300,
  "1h": 3600,
  "1d": 86400,
  "1wk": 604800,
};

/** Seconds per bar for a Yahoo interval string such as "1m" or "1d". */
export function barSeconds(interval: string): number {
  return BAR_SECONDS[interval] ?? 86400;
}

/** Only minute-level bars can be extended by live ticks in a meaningful way. */
export function isLiveInterval(interval: string): boolean {
  return interval === "1m" || interval === "5m";
}
