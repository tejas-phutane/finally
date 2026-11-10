"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Portfolio, PortfolioSnapshot } from "@/lib/types";

const PORTFOLIO_POLL_MS = 10_000;
const HISTORY_POLL_MS = 30_000; // backend records a snapshot every 30s

export function usePortfolio(onError?: (message: string) => void): {
  portfolio: Portfolio | null;
  history: PortfolioSnapshot[];
  refresh: () => Promise<void>;
} {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [history, setHistory] = useState<PortfolioSnapshot[]>([]);

  const refreshPortfolio = useCallback(async () => {
    try {
      setPortfolio(await api.getPortfolio());
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Portfolio unavailable");
    }
  }, [onError]);

  const refreshHistory = useCallback(async () => {
    try {
      setHistory(await api.getPortfolioHistory());
    } catch {
      // history is non-critical; keep the previous series
    }
  }, []);

  const refresh = useCallback(async () => {
    await Promise.all([refreshPortfolio(), refreshHistory()]);
  }, [refreshPortfolio, refreshHistory]);

  useEffect(() => {
    // Initial load + polling: state is set only after the await inside refresh().
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    const portfolioTimer = setInterval(refreshPortfolio, PORTFOLIO_POLL_MS);
    const historyTimer = setInterval(refreshHistory, HISTORY_POLL_MS);
    return () => {
      clearInterval(portfolioTimer);
      clearInterval(historyTimer);
    };
  }, [refresh, refreshPortfolio, refreshHistory]);

  return { portfolio, history, refresh };
}
