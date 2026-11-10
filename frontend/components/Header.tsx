import type { ConnectionStatus } from "@/hooks/usePriceStream";
import { formatMoney } from "@/lib/format";

const DOT: Record<ConnectionStatus, string> = {
  connected: "bg-up",
  reconnecting: "bg-accent",
  disconnected: "bg-down",
};

const LABEL: Record<ConnectionStatus, string> = {
  connected: "Live",
  reconnecting: "Reconnecting",
  disconnected: "Disconnected",
};

export function Header({
  totalValue,
  cash,
  status,
}: {
  totalValue: number | null;
  cash: number | null;
  status: ConnectionStatus;
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
        <div className="flex items-center gap-2" data-testid="connection-status" data-status={status}>
          <span className={`inline-block h-2.5 w-2.5 rounded-full ${DOT[status]}`} aria-hidden="true" />
          <span className="text-xs text-muted">{LABEL[status]}</span>
        </div>
      </div>
    </header>
  );
}
