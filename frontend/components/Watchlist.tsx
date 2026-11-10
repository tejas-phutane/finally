"use client";

import { useState, type FormEvent } from "react";
import { FlashPrice } from "./Flash";
import { Sparkline } from "./Sparkline";
import type { HistoryMap } from "@/hooks/usePriceStream";
import { formatPercent, formatPrice, pnlClass } from "@/lib/format";
import type { PriceMap, WatchlistItem } from "@/lib/types";

export const TICKER_RE = /^[A-Z]{1,10}$/;

export function Watchlist({
  items,
  prices,
  history,
  selected,
  error,
  onSelect,
  onAdd,
  onRemove,
}: {
  items: WatchlistItem[];
  prices: PriceMap;
  history: HistoryMap;
  selected: string | null;
  error: string | null;
  onSelect: (ticker: string) => void;
  onAdd: (ticker: string) => Promise<boolean>;
  onRemove: (ticker: string) => Promise<boolean>;
}) {
  const [input, setInput] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const ticker = input.trim().toUpperCase();
    if (!TICKER_RE.test(ticker)) return;
    if (await onAdd(ticker)) setInput("");
  };

  return (
    <section className="flex h-full flex-col">
      <PanelTitle>Watchlist</PanelTitle>
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-panel text-left text-xs text-muted">
            <tr>
              <th className="px-2 py-1 font-normal">Ticker</th>
              <th className="px-2 py-1 text-right font-normal">Price</th>
              <th className="px-2 py-1 text-right font-normal">Day %</th>
              <th className="px-2 py-1 font-normal">Trend</th>
              <th className="w-6" />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const live = prices[item.ticker];
              const price = live?.price ?? item.price;
              const values = (history[item.ticker] ?? []).slice(-60).map((p) => p.value);
              const isSelected = selected === item.ticker;
              return (
                <tr
                  key={item.ticker}
                  data-testid="watchlist-row"
                  data-ticker={item.ticker}
                  onClick={() => onSelect(item.ticker)}
                  className={`cursor-pointer border-t border-border/50 hover:bg-white/5 ${
                    isSelected ? "bg-primary/15" : ""
                  }`}
                >
                  <td className="px-2 py-1 font-semibold">{item.ticker}</td>
                  <td className="px-2 py-1 text-right">
                    <FlashPrice value={price} text={formatPrice(price)} />
                  </td>
                  <td className={`px-2 py-1 text-right font-mono tabular-nums ${pnlClass(item.day_change_percent)}`}>
                    {formatPercent(item.day_change_percent)}
                  </td>
                  <td className="px-2 py-1">
                    <Sparkline values={values} />
                  </td>
                  <td className="px-1 text-center">
                    <button
                      type="button"
                      data-testid="watchlist-remove-button"
                      aria-label={`Remove ${item.ticker}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        void onRemove(item.ticker);
                      }}
                      className="text-muted hover:text-down"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <form onSubmit={submit} className="flex gap-2 border-t border-border p-2">
        <input
          data-testid="watchlist-add-input"
          value={input}
          onChange={(e) => setInput(e.target.value.toUpperCase())}
          placeholder="Add ticker"
          maxLength={10}
          className="min-w-0 flex-1 rounded border border-border bg-bg px-2 py-1 font-mono text-sm uppercase outline-none focus:border-primary"
        />
        <button
          type="submit"
          data-testid="watchlist-add-button"
          className="rounded bg-primary px-3 py-1 text-sm font-semibold text-black hover:brightness-110"
        >
          Add
        </button>
      </form>
      {error && <p className="px-2 pb-2 text-xs text-down">{error}</p>}
    </section>
  );
}

export function PanelTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="border-b border-border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
      {children}
    </h2>
  );
}
