// Thin wrappers over the backend REST API. All URLs are relative (same origin).
import type { Candle } from "@/lib/candles";
import type {
  ChatMessage,
  ChatResponse,
  Portfolio,
  PortfolioSnapshot,
  TradeResponse,
  WatchlistItem,
} from "./types";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json", ...init.headers } : init?.headers,
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { detail?: unknown };
      if (typeof body.detail === "string") message = body.detail;
    } catch {
      // non-JSON error body: keep generic message
    }
    throw new ApiError(res.status, message);
  }
  return (await res.json()) as T;
}

export const api = {
  getPortfolio: () => request<Portfolio>("/api/portfolio"),

  getPortfolioHistory: () => request<PortfolioSnapshot[]>("/api/portfolio/history"),
  getCandles: (ticker: string, interval = "1m") =>
    request<{ ticker: string; interval: string; candles: Candle[] }>(
      `/api/market/candles?ticker=${encodeURIComponent(ticker)}&interval=${interval}`,
    ),

  trade: (ticker: string, quantity: number, side: "buy" | "sell") =>
    request<TradeResponse>("/api/portfolio/trade", {
      method: "POST",
      body: JSON.stringify({ ticker, quantity, side }),
    }),

  getWatchlist: () => request<WatchlistItem[]>("/api/watchlist"),

  addWatchlist: (ticker: string) =>
    request<WatchlistItem[]>("/api/watchlist", {
      method: "POST",
      body: JSON.stringify({ ticker }),
    }),

  removeWatchlist: (ticker: string) =>
    request<WatchlistItem[]>(`/api/watchlist/${encodeURIComponent(ticker)}`, {
      method: "DELETE",
    }),

  getChatHistory: () => request<ChatMessage[]>("/api/chat/history"),

  sendChat: (message: string) =>
    request<ChatResponse>("/api/chat", {
      method: "POST",
      body: JSON.stringify({ message }),
    }),
};
