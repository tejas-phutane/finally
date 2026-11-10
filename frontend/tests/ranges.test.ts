import { describe, expect, it } from "vitest";
import { applyTick, type Candle } from "@/lib/candles";
import { barSeconds, isLiveInterval, RANGE_KEYS } from "@/lib/ranges";

describe("ranges", () => {
  it("offers the seven ranges in order", () => {
    expect(RANGE_KEYS).toEqual(["1D", "5D", "1M", "3M", "6M", "1Y", "5Y"]);
  });

  it("maps Yahoo intervals to seconds per bar", () => {
    expect(barSeconds("1m")).toBe(60);
    expect(barSeconds("5m")).toBe(300);
    expect(barSeconds("1h")).toBe(3600);
    expect(barSeconds("1d")).toBe(86400);
    expect(barSeconds("1wk")).toBe(604800);
  });

  it("only minute bars take live ticks", () => {
    expect(isLiveInterval("1m")).toBe(true);
    expect(isLiveInterval("5m")).toBe(true);
    expect(isLiveInterval("1d")).toBe(false);
    expect(isLiveInterval("1wk")).toBe(false);
  });
});

describe("applyTick with bar size", () => {
  const daily: Candle[] = [{ time: 86400 * 10, open: 1, high: 2, low: 1, close: 2, volume: 0 }];

  it("folds ticks into the same day bar", () => {
    const out = applyTick(daily, { time: 86400 * 10 + 3600, price: 3 }, 86400);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ high: 3, close: 3 });
  });

  it("opens a new day bar on the next day", () => {
    const out = applyTick(daily, { time: 86400 * 11 + 60, price: 5 }, 86400);
    expect(out).toHaveLength(2);
    expect(out[1]).toMatchObject({ time: 86400 * 11, open: 2, close: 5 });
  });
});
