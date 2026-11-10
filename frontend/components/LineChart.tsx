"use client";

import { useEffect, useRef } from "react";
import {
  ColorType,
  LineSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { LinePoint } from "@/lib/chart";

/**
 * Canvas line chart (TradingView Lightweight Charts v5).
 * `data` must already be sorted and unique by time (see lib/chart.ts).
 */
export function LineChart({
  data,
  color,
  testId,
  ticker,
}: {
  data: LinePoint[];
  color: string;
  testId: string;
  ticker?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Line"> | null>(null);

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
    const series = chart.addSeries(LineSeries, { color, lineWidth: 2, priceLineVisible: false });
    chartRef.current = chart;
    seriesRef.current = series;
    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [color]);

  useEffect(() => {
    seriesRef.current?.setData(
      data.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })),
    );
    chartRef.current?.timeScale().fitContent();
  }, [data]);

  return (
    <div
      ref={containerRef}
      data-testid={testId}
      data-ticker={ticker}
      data-point-count={data.length}
      className="h-full w-full"
    />
  );
}
