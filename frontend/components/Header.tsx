import type { ConnectionStatus } from "@/hooks/usePriceStream";
import type { MarketState } from "@/lib/market";
import { formatMoney } from "@/lib/format";

const DOT: Record<ConnectionStatus, string> = {
  connected: "bg-up",
  reconnecting: "bg-accent",
  disconnected: "bg-down",
};

const MARKET_DOT: Record<MarketState, string> = {
  live: "bg-up",
  last: "bg-accent",
  none: "bg-muted",
};

function marketLabel(market: MarketState, lastTs: number | null): string {
  if (market === "live") return "MARKET LIVE";
  if (market === "none" || lastTs == null) return "NO DATA";
  const when = new Date(lastTs * 1000).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `LAST DATA · ${when}`;
}

const LABEL: Record<ConnectionStatus, string> = {
  connected: "Connected",
  reconnecting: "Reconnecting",
  disconnected: "Disconnected",
};

export function Header({
  totalValue,
  cash,
  status,
  market,
  lastTs,
}: {
  totalValue: number | null;
  cash: number | null;
  status: ConnectionStatus;
  market: MarketState;
  lastTs: number | null;
}) {
  return (
    <header className="flex items-center justify-between border-b border-border bg-panel px-4 py-2">
      <div className="flex items-baseline gap-2">
        <span className="text-lg font-bold text-accent">FinAlly</span>
        <span className="hidden text-xs text-muted sm:inline">AI Trading Workstation</span>
      </div>
      <div className="flex items-center gap-6 text-sm">
        <div>
          <span className="mr-2 text-muted">Portfolio</span>
          <span data-testid="total-value" className="font-mono text-base font-semibold tabular-nums">
            {totalValue == null ? "—" : formatMoney(totalValue)}
          </span>
        </div>
        <div>
          <span className="mr-2 text-muted">Cash</span>
          <span data-testid="cash-balance" className="font-mono tabular-nums">
            {cash == null ? "—" : formatMoney(cash)}
          </span>
        </div>
        <div className="flex items-center gap-2" data-testid="market-status" data-state={market}>
          <span className={`inline-block h-2.5 w-2.5 rounded-full ${MARKET_DOT[market]}`} aria-hidden="true" />
          <span className="text-xs font-semibold text-muted">{marketLabel(market, lastTs)}</span>
        </div>
        <div className="flex items-center gap-2" data-testid="connection-status" data-status={status}>
          <span className={`inline-block h-2.5 w-2.5 rounded-full ${DOT[status]}`} aria-hidden="true" />
          <span className="text-xs text-muted">{LABEL[status]}</span>
        </div>
      </div>
    </header>
  );
}
