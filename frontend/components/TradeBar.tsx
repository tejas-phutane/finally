"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { TICKER_RE } from "./Watchlist";

export type Side = "buy" | "sell";

/** Validate and normalise the trade form. Returns null if invalid. */
export function buildTradePayload(ticker: string, quantityText: string): { ticker: string; quantity: number } | null {
  const symbol = ticker.trim().toUpperCase();
  const quantity = Number(quantityText);
  if (!TICKER_RE.test(symbol)) return null;
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  return { ticker: symbol, quantity };
}

export function TradeBar({
  selectedTicker,
  onTraded,
}: {
  selectedTicker: string | null;
  onTraded: () => void;
}) {
  const [ticker, setTicker] = useState(selectedTicker ?? "");
  const [quantity, setQuantity] = useState("10");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Clicking a watchlist row fills the ticker field (adjust state during render).
  const [prevSelected, setPrevSelected] = useState(selectedTicker);
  if (selectedTicker !== prevSelected) {
    setPrevSelected(selectedTicker);
    if (selectedTicker) setTicker(selectedTicker);
  }

  const submit = async (side: Side) => {
    setError(null);
    setMessage(null);
    const payload = buildTradePayload(ticker, quantity);
    if (!payload) {
      setError("Enter a valid ticker and a quantity above 0");
      return;
    }
    setBusy(true);
    try {
      const res = await api.trade(payload.ticker, payload.quantity, side);
      const t = res.trade;
      setMessage(`${t.side.toUpperCase()} ${t.quantity} ${t.ticker} @ ${t.price.toFixed(2)}`);
      onTraded();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : "Trade failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section data-testid="trade-bar" className="flex flex-wrap items-center gap-2 border-t border-border bg-panel px-3 py-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted">Trade</span>
      <input
        data-testid="trade-ticker-input"
        aria-label="Ticker"
        value={ticker}
        onChange={(e) => setTicker(e.target.value.toUpperCase())}
        placeholder="Ticker"
        maxLength={10}
        className="w-24 rounded border border-border bg-bg px-2 py-1 font-mono text-sm uppercase outline-none focus:border-primary"
      />
      <input
        data-testid="trade-quantity-input"
        aria-label="Quantity"
        type="number"
        min="0"
        step="any"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        className="w-24 rounded border border-border bg-bg px-2 py-1 font-mono text-sm outline-none focus:border-primary"
      />
      <button
        type="button"
        data-testid="trade-buy-button"
        disabled={busy}
        onClick={() => void submit("buy")}
        className="rounded bg-up px-4 py-1 text-sm font-semibold text-black hover:brightness-110 disabled:opacity-50"
      >
        Buy
      </button>
      <button
        type="button"
        data-testid="trade-sell-button"
        disabled={busy}
        onClick={() => void submit("sell")}
        className="rounded bg-down px-4 py-1 text-sm font-semibold text-black hover:brightness-110 disabled:opacity-50"
      >
        Sell
      </button>
      {error && (
        <span data-testid="trade-error" className="text-xs text-down">
          {error}
        </span>
      )}
      {message && !error && (
        <span data-testid="trade-message" className="text-xs text-up">
          {message}
        </span>
      )}
    </section>
  );
}
