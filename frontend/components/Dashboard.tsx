"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RangeSelector, StyleSelector } from "./ChartControls";
import { ChatPanel } from "./ChatPanel";
import { Header } from "./Header";
import { Heatmap } from "./Heatmap";
import { LineChart } from "./LineChart";
import { PanelTitle, Watchlist } from "./Watchlist";
import { PriceChart } from "./PriceChart";
import { PositionsTable } from "./PositionsTable";
import { TradeBar } from "./TradeBar";
import { useCandles } from "@/hooks/useCandles";
import { useChat } from "@/hooks/useChat";
import { usePortfolio } from "@/hooks/usePortfolio";
import { usePriceStream } from "@/hooks/usePriceStream";
import { useWatchlist } from "@/hooks/useWatchlist";
import { snapshotsToLinePoints } from "@/lib/chart";
import { formatPercent, formatPrice, pnlClass } from "@/lib/format";
import { marketState } from "@/lib/market";
import type { ChartStyle, RangeKey } from "@/lib/ranges";
import { computeLivePortfolio } from "@/lib/portfolio";

export function Dashboard() {
  const { prices, history, status } = usePriceStream();
  const [apiError, setApiError] = useState<string | null>(null);
  const { portfolio, history: pnlHistory, refresh: refreshPortfolio } = usePortfolio(setApiError);
  const { items, error: watchlistError, add, remove, refresh: refreshWatchlist } = useWatchlist();
  const [selected, setSelected] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(true);
  const [range, setRange] = useState<RangeKey>("1D");
  const [chartStyle, setChartStyle] = useState<ChartStyle>("candle");

  // After any trade or chat action, refresh server-side state.
  const refreshAll = useCallback(() => {
    void refreshPortfolio();
    void refreshWatchlist();
  }, [refreshPortfolio, refreshWatchlist]);

  const chat = useChat(refreshAll);

  const activeTicker =
    selected && items.some((i) => i.ticker === selected) ? selected : (items[0]?.ticker ?? null);

  const live = useMemo(
    () => (portfolio ? computeLivePortfolio(portfolio, prices) : null),
    [portfolio, prices],
  );

  const activeItem = items.find((i) => i.ticker === activeTicker);
  const activePrice = activeTicker ? (prices[activeTicker]?.price ?? activeItem?.price ?? null) : null;
  // Newest price timestamp across tickers drives the LIVE / LAST DATA badge.
  const latestTs = useMemo(
    () =>
      Object.values(prices).reduce<number | null>(
        (max, p) => (max == null || p.timestamp > max ? p.timestamp : max),
        null,
      ),
    [prices],
  );
  const [nowSec, setNowSec] = useState(() => Date.now() / 1000);
  useEffect(() => {
    const id = setInterval(() => setNowSec(Date.now() / 1000), 15_000);
    return () => clearInterval(id);
  }, []);
  const market = marketState(latestTs, nowSec);

  // The newest tick for the selected ticker extends its current candle.
  const tick = useMemo(() => {
    const p = activeTicker ? prices[activeTicker] : undefined;
    return p ? { time: p.timestamp, price: p.price } : null;
  }, [prices, activeTicker]);
  const { candles } = useCandles(activeTicker, range, tick);
  const pnlPoints = useMemo(() => snapshotsToLinePoints(pnlHistory), [pnlHistory]);

  return (
    <div className="grid h-dvh grid-rows-[auto_1fr] bg-bg text-foreground">
      <Header
        totalValue={live?.total_value ?? null}
        cash={portfolio?.cash_balance ?? null}
        status={status}
        market={market}
        lastTs={latestTs}
      />
      {apiError && (
        <div className="bg-down/20 px-4 py-1 text-xs text-down">{apiError}</div>
      )}
      <div
        className={`grid min-h-0 ${chatOpen ? "grid-cols-[300px_1fr_340px]" : "grid-cols-[300px_1fr_40px]"}`}
      >
        <div className="min-h-0 border-r border-border bg-panel">
          <Watchlist
            items={items}
            prices={prices}
            history={history}
            selected={activeTicker}
            error={watchlistError}
            onSelect={setSelected}
            onAdd={add}
            onRemove={remove}
          />
        </div>

        <main className="flex min-h-0 min-w-0 flex-col">
          <section className="flex h-[42%] min-h-0 flex-col border-b border-border">
            <div className="flex items-baseline gap-3 border-b border-border px-3 py-1.5">
              <span className="font-semibold">{activeTicker ?? "—"}</span>
              <span className="font-mono tabular-nums">{formatPrice(activePrice)}</span>
              <span className={`font-mono text-sm tabular-nums ${pnlClass(activeItem?.day_change_percent)}`}>
                {formatPercent(activeItem?.day_change_percent)}
              </span>
              <div className="ml-auto flex items-center gap-2">
                <RangeSelector value={range} onChange={setRange} />
                <StyleSelector value={chartStyle} onChange={setChartStyle} />
              </div>
            </div>
            <div className="min-h-0 flex-1">
              {activeTicker && (
                <PriceChart
                  candles={candles}
                  style={chartStyle}
                  testId="main-chart"
                  ticker={activeTicker}
                />
              )}
            </div>
          </section>

          <div className="grid h-[30%] min-h-0 grid-cols-2 border-b border-border">
            <section className="flex min-h-0 flex-col border-r border-border">
              <PanelTitle>Portfolio Heatmap</PanelTitle>
              <div className="min-h-0 flex-1">
                <Heatmap positions={live?.positions ?? []} />
              </div>
            </section>
            <section className="flex min-h-0 flex-col">
              <PanelTitle>Portfolio Value</PanelTitle>
              <div className="min-h-0 flex-1">
                <LineChart data={pnlPoints} color="#209dd7" testId="pnl-chart" />
              </div>
            </section>
          </div>

          <div className="min-h-0 flex-1">
            <PositionsTable positions={live?.positions ?? []} onSelect={setSelected} />
          </div>
          <TradeBar selectedTicker={activeTicker} onTraded={refreshAll} />
        </main>

        <ChatPanel
          messages={chat.messages}
          sending={chat.sending}
          error={chat.error}
          onSend={chat.send}
          collapsed={!chatOpen}
          onToggle={() => setChatOpen((o) => !o)}
        />
      </div>
    </div>
  );
}
