"use client";

import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { Candle } from "@/lib/candles";

/** 1-minute candlesticks (TradingView Lightweight Charts v5). `candles` must be oldest first. */
export function CandleChart({
  candles,
  testId,
  ticker,
}: {
  candles: Candle[];
  testId: string;
  ticker?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "#161b22" },
        textColor: "#8b949e",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "#21262d" },
        horzLines: { color: "#21262d" },
      },
      timeScale: { timeVisible: true, secondsVisible: false, borderColor: "#30363d" },
      rightPriceScale: { borderColor: "#30363d" },
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#3fb950",
      downColor: "#f85149",
      borderVisible: false,
      wickUpColor: "#3fb950",
      wickDownColor: "#f85149",
    });
    chartRef.current = chart;
    seriesRef.current = series;
    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    seriesRef.current?.setData(
      candles.map((c) => ({
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    );
    chartRef.current?.timeScale().fitContent();
  }, [candles]);

  return (
    <div
      ref={containerRef}
      data-testid={testId}
      data-ticker={ticker}
      data-point-count={candles.length}
      className="h-full w-full"
    />
  );
}
