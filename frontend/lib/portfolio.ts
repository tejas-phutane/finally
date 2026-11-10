import type { Portfolio, Position, PriceMap } from "./types";

export interface LivePosition extends Position {
  /** Price used for display: the live SSE price if known, else the server price. */
  live_price: number;
  live_market_value: number;
  live_pnl: number;
  live_pct: number;
}

export interface LivePortfolio {
  cash_balance: number;
  total_value: number;
  unrealized_pnl: number;
  positions: LivePosition[];
}

/**
 * Re-price the server portfolio using live SSE prices so the header total,
 * positions table and heatmap move between server refreshes.
 * Falls back to the server's own price for tickers without a live quote.
 */
export function computeLivePortfolio(portfolio: Portfolio, prices: PriceMap): LivePortfolio {
  const positions: LivePosition[] = portfolio.positions.map((p) => {
    const livePrice = prices[p.ticker]?.price ?? p.current_price;
    const marketValue = p.quantity * livePrice;
    const pnl = (livePrice - p.avg_cost) * p.quantity;
    const pct = p.avg_cost === 0 ? 0 : ((livePrice - p.avg_cost) / p.avg_cost) * 100;
    return {
      ...p,
      live_price: livePrice,
      live_market_value: marketValue,
      live_pnl: pnl,
      live_pct: pct,
    };
  });

  const investedValue = positions.reduce((sum, p) => sum + p.live_market_value, 0);
  const totalValue = portfolio.cash_balance + investedValue;
  const unrealized = positions.reduce((sum, p) => sum + p.live_pnl, 0);

  return {
    cash_balance: portfolio.cash_balance,
    total_value: totalValue,
    unrealized_pnl: unrealized,
    positions: positions.map((p) => ({
      ...p,
      weight: totalValue === 0 ? 0 : p.live_market_value / totalValue,
    })),
  };
}
