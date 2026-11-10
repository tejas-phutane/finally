import { PanelTitle } from "./Watchlist";
import { formatPercent, formatPrice, formatQuantity, formatSigned, pnlClass } from "@/lib/format";
import type { LivePosition } from "@/lib/portfolio";

export function PositionsTable({
  positions,
  onSelect,
}: {
  positions: LivePosition[];
  onSelect: (ticker: string) => void;
}) {
  return (
    <section className="flex h-full flex-col">
      <PanelTitle>Positions</PanelTitle>
      <div className="flex-1 overflow-auto">
        <table data-testid="positions-table" className="w-full text-sm">
          <thead className="sticky top-0 bg-panel text-right text-xs text-muted">
            <tr>
              <th className="px-2 py-1 text-left font-normal">Ticker</th>
              <th className="px-2 py-1 font-normal">Qty</th>
              <th className="px-2 py-1 font-normal">Avg Cost</th>
              <th className="px-2 py-1 font-normal">Price</th>
              <th className="px-2 py-1 font-normal">Unrealized P&amp;L</th>
              <th className="px-2 py-1 font-normal">% Chg</th>
            </tr>
          </thead>
          <tbody>
            {positions.length === 0 && (
              <tr>
                <td colSpan={6} className="px-2 py-3 text-center text-muted">
                  No open positions
                </td>
              </tr>
            )}
            {positions.map((p) => (
              <tr
                key={p.ticker}
                data-testid="position-row"
                data-ticker={p.ticker}
                onClick={() => onSelect(p.ticker)}
                className="cursor-pointer border-t border-border/50 text-right font-mono tabular-nums hover:bg-white/5"
              >
                <td className="px-2 py-1 text-left font-sans font-semibold">{p.ticker}</td>
                <td data-testid="quantity" className="px-2 py-1">{formatQuantity(p.quantity)}</td>
                <td data-testid="avg-cost" className="px-2 py-1">{formatPrice(p.avg_cost)}</td>
                <td data-testid="current-price" className="px-2 py-1">{formatPrice(p.live_price)}</td>
                <td data-testid="unrealized-pnl" className={`px-2 py-1 ${pnlClass(p.live_pnl)}`}>
                  {formatSigned(p.live_pnl)}
                </td>
                <td data-testid="pct-change" className={`px-2 py-1 ${pnlClass(p.live_pct)}`}>
                  {formatPercent(p.live_pct)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
