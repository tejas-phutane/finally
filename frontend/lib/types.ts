// Shapes returned by the FinAlly backend (see planning/CONTRACTS.md, HTTP API).

export type Direction = "up" | "down" | "flat";

/** One entry of the SSE payload: `data: {"AAPL": PriceUpdate, ...}` */
export interface PriceUpdate {
  ticker: string;
  price: number;
  previous_price: number;
  timestamp: number;
  change: number;
  change_percent: number;
  direction: Direction;
}

export type PriceMap = Record<string, PriceUpdate>;

export interface Position {
  ticker: string;
  quantity: number;
  avg_cost: number;
  current_price: number;
  market_value: number;
  unrealized_pnl: number;
  pct_change: number;
  weight: number;
}

export interface Portfolio {
  cash_balance: number;
  total_value: number;
  unrealized_pnl: number;
  positions: Position[];
}

export interface Trade {
  id: string;
  ticker: string;
  side: "buy" | "sell";
  quantity: number;
  price: number;
  executed_at: string;
}

export interface TradeResponse {
  trade: Trade;
  portfolio: Portfolio;
}

export interface PortfolioSnapshot {
  total_value: number;
  recorded_at: string;
}

export interface WatchlistItem {
  ticker: string;
  price: number | null;
  previous_price: number | null;
  change_percent: number | null;
  direction: Direction | null;
  session_open: number | null;
  day_change_percent: number | null;
  timestamp: number | null;
}

export interface TradeAction {
  ticker: string;
  side: "buy" | "sell";
  quantity: number;
  status: "executed" | "failed";
  price?: number;
  error?: string;
}

export interface WatchlistAction {
  ticker: string;
  action: "add" | "remove";
  status: "executed" | "failed";
  error?: string;
}

export interface ChatActions {
  trades?: TradeAction[];
  watchlist_changes?: WatchlistAction[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  actions: ChatActions | null;
  created_at: string;
}

export interface ChatResponse {
  message: string;
  trades: TradeAction[];
  watchlist_changes: WatchlistAction[];
}
