"use client";

import { useEffect, useState } from "react";
import type { PriceMap } from "@/lib/types";

export type ConnectionStatus = "connected" | "reconnecting" | "disconnected";

export interface HistoryPoint {
  time: number; // unix seconds
  value: number;
}

export type HistoryMap = Record<string, HistoryPoint[]>;

export const MAX_HISTORY_POINTS = 300;
const RECONNECT_DELAY_MS = 3000;

/** Append one SSE snapshot to the per-ticker history, capped at `maxPoints`. Pure. */
export function appendHistory(
  history: HistoryMap,
  prices: PriceMap,
  maxPoints = MAX_HISTORY_POINTS,
): HistoryMap {
  const next: HistoryMap = { ...history };
  for (const [ticker, update] of Object.entries(prices)) {
    const prev = next[ticker] ?? [];
    const point = { time: update.timestamp, value: update.price };
    next[ticker] = [...prev, point].slice(-maxPoints);
  }
  return next;
}

/**
 * Subscribes to GET /api/stream/prices (EventSource) and keeps the latest
 * price per ticker plus a history accumulated since page load.
 * EventSource retries on its own while CONNECTING; if the browser gives up
 * (CLOSED), we reopen the stream ourselves after a short delay.
 */
export function usePriceStream(): {
  prices: PriceMap;
  history: HistoryMap;
  status: ConnectionStatus;
} {
  const [prices, setPrices] = useState<PriceMap>({});
  const [history, setHistory] = useState<HistoryMap>({});
  const [status, setStatus] = useState<ConnectionStatus>("reconnecting");

  useEffect(() => {
    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    const open = () => {
      source = new EventSource("/api/stream/prices");

      source.onopen = () => setStatus("connected");

      source.onmessage = (event: MessageEvent<string>) => {
        const data = JSON.parse(event.data) as PriceMap;
        setPrices((prev) => ({ ...prev, ...data }));
        setHistory((prev) => appendHistory(prev, data));
      };

      source.onerror = () => {
        if (closed) return;
        if (source && source.readyState === EventSource.CLOSED) {
          setStatus("disconnected");
          retryTimer = setTimeout(open, RECONNECT_DELAY_MS);
        } else {
          setStatus("reconnecting");
        }
      };
    };

    open();

    return () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      source?.close();
    };
  }, []);

  return { prices, history, status };
}

