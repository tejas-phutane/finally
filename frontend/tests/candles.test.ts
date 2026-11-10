import { describe, expect, it } from "vitest";
import { applyTick, type Candle } from "@/lib/candles";
import { marketState } from "@/lib/market";

const base: Candle[] = [
  { time: 600, open: 10, high: 12, low: 9, close: 11, volume: 5 },
];

describe("applyTick", () => {
  it("starts a candle when there is no history", () => {
    const out = applyTick([], { time: 605, price: 42 });
    expect(out).toEqual([{ time: 600, open: 42, high: 42, low: 42, close: 42, volume: 0 }]);
  });

  it("updates the current candle within the same minute", () => {
    const out = applyTick(base, { time: 630, price: 13 });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ time: 600, open: 10, high: 13, low: 9, close: 13 });
  });

  it("widens low when a lower price arrives in the same minute", () => {
    const out = applyTick(base, { time: 610, price: 8 });
    expect(out[0]).toMatchObject({ high: 12, low: 8, close: 8 });
  });

  it("opens a new candle at the previous close in a later minute", () => {
    const out = applyTick(base, { time: 661, price: 11.5 });
    expect(out).toHaveLength(2);
    expect(out[1]).toMatchObject({ time: 660, open: 11, high: 11.5, low: 11, close: 11.5 });
  });

  it("ignores out-of-order ticks so times stay ascending", () => {
    const out = applyTick(base, { time: 500, price: 1 });
    expect(out).toBe(base);
  });
});

describe("marketState", () => {
  const now = 1_000_000;

  it("is none without any price", () => {
    expect(marketState(null, now)).toBe("none");
  });

  it("is live when the newest price is fresh", () => {
    expect(marketState(now - 60, now)).toBe("live");
    expect(marketState(now - 180, now)).toBe("live");
  });

  it("is last when prices are older than the window", () => {
    expect(marketState(now - 181, now)).toBe("last");
    expect(marketState(now - 86_400, now)).toBe("last");
  });
});
