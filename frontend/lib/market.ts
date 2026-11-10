export type MarketState = "live" | "last" | "none";

/**
 * Is the feed live or showing old data? Pure.
 * `latestTs` is the newest price timestamp (unix seconds) across all tickers.
 * Prices are fresh if they are no older than `freshSec`. Outside market hours
 * Yahoo returns the last session's bars, so they are older and shown as "last".
 */
export function marketState(
  latestTs: number | null,
  nowSec: number,
  freshSec = 180,
): MarketState {
  if (latestTs == null) return "none";
  return nowSec - latestTs <= freshSec ? "live" : "last";
}
