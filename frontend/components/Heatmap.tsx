"use client";

import { useEffect, useRef, useState } from "react";
import { heatmapColor, pnlSign } from "@/lib/colors";
import { formatPercent } from "@/lib/format";
import { squarify } from "@/lib/treemap";
import type { LivePosition } from "@/lib/portfolio";

/** Treemap: tile area = portfolio weight, tile color = % P&L vs avg cost. */
export function Heatmap({ positions }: { positions: LivePosition[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const tiles = squarify(
    positions.map((p) => ({ id: p.ticker, value: p.live_market_value })),
    size.w,
    size.h,
  );
  const byTicker = new Map(positions.map((p) => [p.ticker, p]));

  return (
    <div ref={ref} data-testid="portfolio-heatmap" className="relative h-full w-full">
      {positions.length === 0 && (
        <p className="p-3 text-sm text-muted">No positions yet. Buy shares to see the heatmap.</p>
      )}
      {tiles.map((t) => {
        const p = byTicker.get(t.id)!;
        return (
          <div
            key={t.id}
            data-testid="heatmap-tile"
            data-ticker={t.id}
            data-pnl={pnlSign(p.live_pct)}
            title={`${t.id} ${formatPercent(p.live_pct)}`}
            className="absolute flex flex-col items-center justify-center overflow-hidden border border-bg text-xs font-semibold text-white"
            style={{
              left: t.x,
              top: t.y,
              width: t.w,
              height: t.h,
              background: heatmapColor(p.live_pct),
            }}
          >
            <span>{t.id}</span>
            {t.w > 60 && t.h > 36 && <span className="font-mono font-normal">{formatPercent(p.live_pct)}</span>}
          </div>
        );
      })}
    </div>
  );
}
