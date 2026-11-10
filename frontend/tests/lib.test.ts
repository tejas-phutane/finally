import { describe, expect, it } from "vitest";
import { appendHistory } from "@/hooks/usePriceStream";
import { toLinePoints, snapshotsToLinePoints } from "@/lib/chart";
import { computeLivePortfolio } from "@/lib/portfolio";
import { squarify } from "@/lib/treemap";
import { heatmapColor, pnlSign } from "@/lib/colors";
import { formatPercent, formatQuantity } from "@/lib/format";
import type { Portfolio, PriceMap } from "@/lib/types";

const upd = (ticker: string, price: number, ts = 1000) => ({
  ticker,
  price,
  previous_price: price,
  timestamp: ts,
  change: 0,
  change_percent: 0,
  direction: "flat" as const,
});

describe("appendHistory", () => {
  it("accumulates points per ticker and caps the length", () => {
    let h = appendHistory({}, { AAPL: upd("AAPL", 1, 1) }, 2);
    h = appendHistory(h, { AAPL: upd("AAPL", 2, 2) }, 2);
    h = appendHistory(h, { AAPL: upd("AAPL", 3, 3) }, 2);
    expect(h.AAPL.map((p) => p.value)).toEqual([2, 3]);
  });
});

describe("chart points", () => {
  it("sorts by time and dedupes same-second points keeping the last", () => {
    const pts = toLinePoints([
      { time: 5.2, value: 1 },
      { time: 4.9, value: 2 },
      { time: 5.7, value: 3 },
    ]);
    expect(pts).toEqual([
      { time: 4, value: 2 },
      { time: 5, value: 3 },
    ]);
  });

  it("converts snapshot ISO timestamps to unix seconds", () => {
    const pts = snapshotsToLinePoints([{ total_value: 10000, recorded_at: "2026-01-01T00:00:00Z" }]);
    expect(pts).toEqual([{ time: 1767225600, value: 10000 }]);
  });
});

describe("computeLivePortfolio", () => {
  const portfolio: Portfolio = {
    cash_balance: 1000,
    total_value: 0,
    unrealized_pnl: 0,
    positions: [
      { ticker: "AAPL", quantity: 10, avg_cost: 100, current_price: 110, market_value: 1100, unrealized_pnl: 100, pct_change: 10, weight: 0.5 },
      { ticker: "MSFT", quantity: 5, avg_cost: 200, current_price: 180, market_value: 900, unrealized_pnl: -100, pct_change: -10, weight: 0.5 },
    ],
  };

  it("reprices positions with live prices and totals cash plus holdings", () => {
    const prices: PriceMap = { AAPL: upd("AAPL", 120), MSFT: upd("MSFT", 190) };
    const live = computeLivePortfolio(portfolio, prices);
    expect(live.total_value).toBeCloseTo(1000 + 1200 + 950);
    expect(live.unrealized_pnl).toBeCloseTo(200 + -50);
    const aapl = live.positions.find((p) => p.ticker === "AAPL")!;
    expect(aapl.live_pct).toBeCloseTo(20);
    expect(aapl.weight).toBeCloseTo(1200 / 3150);
  });

  it("falls back to server prices when there is no live quote", () => {
    const live = computeLivePortfolio(portfolio, {});
    expect(live.total_value).toBeCloseTo(1000 + 1100 + 900);
  });
});

describe("squarify", () => {
  it("tiles the full rectangle with areas proportional to values", () => {
    const rects = squarify(
      [
        { id: "a", value: 6 },
        { id: "b", value: 3 },
        { id: "c", value: 1 },
      ],
      100,
      50,
    );
    expect(rects).toHaveLength(3);
    const total = rects.reduce((s, r) => s + r.w * r.h, 0);
    expect(total).toBeCloseTo(5000, 3);
    const a = rects.find((r) => r.id === "a")!;
    expect((a.w * a.h) / 5000).toBeCloseTo(0.6, 5);
  });

  it("skips non-positive values and handles empty input", () => {
    expect(squarify([], 10, 10)).toEqual([]);
    expect(squarify([{ id: "x", value: 0 }], 10, 10)).toEqual([]);
  });
});

describe("colors and formatting", () => {
  it("classifies P&L sign", () => {
    expect(pnlSign(1.5)).toBe("gain");
    expect(pnlSign(-0.1)).toBe("loss");
    expect(pnlSign(0)).toBe("flat");
  });

  it("uses green for gains and red for losses", () => {
    expect(heatmapColor(2)).toContain("63, 185, 80");
    expect(heatmapColor(-2)).toContain("248, 81, 73");
  });

  it("formats percent and quantity", () => {
    expect(formatPercent(1.234)).toBe("+1.23%");
    expect(formatPercent(-2)).toBe("-2.00%");
    expect(formatQuantity(10)).toBe("10");
    expect(formatQuantity(0.5)).toBe("0.5");
  });
});
