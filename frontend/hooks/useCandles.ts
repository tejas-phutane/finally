"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { applyTick, type Candle, type Tick } from "@/lib/candles";
import { barSeconds, isLiveInterval, type RangeKey } from "@/lib/ranges";

interface CandleState {
  ticker: string | null;
  range: RangeKey | null;
  interval: string;
  candles: Candle[];
}

/**
 * Candles for one ticker over one range. Minute-level ranges (1D, 5D) are
 * extended by live ticks; daily and longer ranges show history only.
 * State is tagged with ticker and range, so a late response or tick for a
 * previous selection is never shown for the current one.
 */
export function useCandles(
  ticker: string | null,
  range: RangeKey,
  tick: Tick | null,
): { candles: Candle[]; interval: string } {
  const [state, setState] = useState<CandleState>({
    ticker: null,
    range: null,
    interval: "1d",
    candles: [],
  });

  // Load history when ticker or range changes.
  useEffect(() => {
    if (!ticker) return;
    let cancelled = false;
    api
      .getCandles(ticker, range)
      .then((res) => {
        if (!cancelled)
          setState({ ticker, range, interval: res.interval, candles: res.candles });
      })
      .catch(() => {
        if (!cancelled) setState({ ticker, range, interval: "1d", candles: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [ticker, range]);

  // Fold live ticks into the current minute bar, only for this selection.
  useEffect(() => {
    if (!ticker || !tick) return;
    // The state update is a reaction to the external tick stream, not a derived value.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((prev) => {
      if (prev.ticker !== ticker || prev.range !== range || !isLiveInterval(prev.interval)) {
        return prev;
      }
      return { ...prev, candles: applyTick(prev.candles, tick, barSeconds(prev.interval)) };
    });
  }, [ticker, range, tick]);

  const current = state.ticker === ticker && state.range === range;
  return { candles: current ? state.candles : [], interval: current ? state.interval : "1d" };
}
