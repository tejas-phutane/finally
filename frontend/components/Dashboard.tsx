"use client";

import { useCallback, useMemo, useState } from "react";
import { ChatPanel } from "./ChatPanel";
import { Header } from "./Header";
import { Heatmap } from "./Heatmap";
import { LineChart } from "./LineChart";
import { PanelTitle, Watchlist } from "./Watchlist";
import { PositionsTable } from "./PositionsTable";
import { TradeBar } from "./TradeBar";
import { useChat } from "@/hooks/useChat";
import { usePortfolio } from "@/hooks/usePortfolio";
import { usePriceStream } from "@/hooks/usePriceStream";
import { useWatchlist } from "@/hooks/useWatchlist";
import { snapshotsToLinePoints, toLinePoints } from "@/lib/chart";
import { formatPercent, formatPrice, pnlClass } from "@/lib/format";
import { computeLivePortfolio } from "@/lib/portfolio";

export function Dashboard() {
  const { prices, history, status } = usePriceStream();
  const [apiError, setApiError] = useState<string | null>(null);
  const { portfolio, history: pnlHistory, refresh: refreshPortfolio } = usePortfolio(setApiError);
  const { items, error: watchlistError, add, remove, refresh: refreshWatchlist } = useWatchlist();
  const [selected, setSelected] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(true);

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
  const mainPoints = useMemo(
    () => (activeTicker ? toLinePoints(history[activeTicker] ?? []) : []),
    [history, activeTicker],
  );
  const pnlPoints = useMemo(() => snapshotsToLinePoints(pnlHistory), [pnlHistory]);

  return (
    <div className="grid h-dvh grid-rows-[auto_1fr] bg-bg text-foreground">
      <Header
        totalValue={live?.total_value ?? null}
        cash={portfolio?.cash_balance ?? null}
        status={status}
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

        <main className="flex min-h-0 flex-col">
          <section className="flex h-[42%] min-h-0 flex-col border-b border-border">
            <div className="flex items-baseline gap-3 border-b border-border px-3 py-1.5">
              <span className="font-semibold">{activeTicker ?? "—"}</span>
              <span className="font-mono tabular-nums">{formatPrice(activePrice)}</span>
              <span className={`font-mono text-sm tabular-nums ${pnlClass(activeItem?.day_change_percent)}`}>
                {formatPercent(activeItem?.day_change_percent)}
              </span>
            </div>
            <div className="min-h-0 flex-1">
              {activeTicker && (
                <LineChart
                  data={mainPoints}
                  color="#ecad0a"
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
