export interface Candle {
  time: number; // unix seconds, start of the bar
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Tick {
  time: number; // unix seconds
  price: number;
}

const BAR_SECONDS = 60;

/**
 * Fold one live tick into 1-minute candles. Pure.
 * - same minute as the last candle: update its high/low/close
 * - a later minute: open a new candle at the previous close
 * - an older tick (out of order): ignored
 * Keeps times strictly ascending, which Lightweight Charts requires.
 */
export function applyTick(candles: Candle[], tick: Tick): Candle[] {
  const bucket = Math.floor(tick.time / BAR_SECONDS) * BAR_SECONDS;
  const p = tick.price;
  if (candles.length === 0) {
    return [{ time: bucket, open: p, high: p, low: p, close: p, volume: 0 }];
  }
  const last = candles[candles.length - 1];
  if (bucket < last.time) return candles;
  if (bucket === last.time) {
    const updated: Candle = {
      ...last,
      high: Math.max(last.high, p),
      low: Math.min(last.low, p),
      close: p,
    };
    return [...candles.slice(0, -1), updated];
  }
  return [
    ...candles,
    {
      time: bucket,
      open: last.close,
      high: Math.max(last.close, p),
      low: Math.min(last.close, p),
      close: p,
      volume: 0,
    },
  ];
}
