"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, api } from "@/lib/api";
import type { WatchlistItem } from "@/lib/types";

const WATCHLIST_POLL_MS = 10_000; // refreshes day_change_percent; live prices come from SSE

export function useWatchlist(): {
  items: WatchlistItem[];
  error: string | null;
  add: (ticker: string) => Promise<boolean>;
  remove: (ticker: string) => Promise<boolean>;
  refresh: () => Promise<void>;
} {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setItems(await api.getWatchlist());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Watchlist unavailable");
    }
  }, []);

  useEffect(() => {
    // Initial load + polling: state is set only after the await inside refresh().
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    const timer = setInterval(refresh, WATCHLIST_POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  const add = useCallback(async (ticker: string) => {
    try {
      setItems(await api.addWatchlist(ticker));
      setError(null);
      return true;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add ticker");
      return false;
    }
  }, []);

  const remove = useCallback(async (ticker: string) => {
    try {
      setItems(await api.removeWatchlist(ticker));
      setError(null);
      return true;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove ticker");
      return false;
    }
  }, []);

  return { items, error, add, remove, refresh };
}
