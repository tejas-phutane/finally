"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { applyTick, type Candle, type Tick } from "@/lib/candles";

/**
 * Candles for one ticker: fetched history, then extended by live ticks.
 * State is tagged with its ticker, so a late response or tick for a previous
 * selection is never shown for the current one.
 */
export function useCandles(ticker: string | null, tick: Tick | null): Candle[] {
  const [state, setState] = useState<{ ticker: string | null; candles: Candle[] }>({
    ticker: null,
    candles: [],
  });

  // Load history when the selected ticker changes.
  useEffect(() => {
    if (!ticker) return;
    let cancelled = false;
    api
      .getCandles(ticker)
      .then((res) => {
        if (!cancelled) setState({ ticker, candles: res.candles });
      })
      .catch(() => {
        if (!cancelled) setState({ ticker, candles: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  // Fold each live tick into the current candle, but only for this ticker.
  useEffect(() => {
    if (!ticker || !tick) return;
    // The state update is a reaction to the external tick stream, not a derived value.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((prev) =>
      prev.ticker === ticker ? { ticker, candles: applyTick(prev.candles, tick) } : prev,
    );
  }, [ticker, tick]);

  return state.ticker === ticker ? state.candles : [];
}
