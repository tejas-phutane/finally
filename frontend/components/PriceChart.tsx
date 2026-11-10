"use client";

import { useEffect, useRef } from "react";
import {
  AreaSeries,
  BarSeries,
  CandlestickSeries,
  ColorType,
  LineSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type SeriesType,
  type UTCTimestamp,
} from "lightweight-charts";
import type { Candle } from "@/lib/candles";
import type { ChartStyle } from "@/lib/ranges";

const UP = "#3fb950";
const DOWN = "#f85149";
const ACCENT = "#ecad0a";

/**
 * Price chart with a selectable drawing style (Lightweight Charts v5).
 * `candles` must be oldest first. Line and area use the close price.
 */
export function PriceChart({
  candles,
  style,
  testId,
  ticker,
}: {
  candles: Candle[];
  style: ChartStyle;
  testId: string;
  ticker?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<SeriesType> | null>(null);

  // One chart for the lifetime of the component.
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
    chartRef.current = chart;
    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // Swap the series when the style changes.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    if (seriesRef.current) chart.removeSeries(seriesRef.current);
    switch (style) {
      case "bar":
        seriesRef.current = chart.addSeries(BarSeries, { upColor: UP, downColor: DOWN });
        break;
      case "line":
        seriesRef.current = chart.addSeries(LineSeries, {
          color: ACCENT,
          lineWidth: 2,
          priceLineVisible: false,
        });
        break;
      case "area":
        seriesRef.current = chart.addSeries(AreaSeries, {
          lineColor: ACCENT,
          topColor: "rgba(236, 173, 10, 0.35)",
          bottomColor: "rgba(236, 173, 10, 0.02)",
          lineWidth: 2,
          priceLineVisible: false,
        });
        break;
      default:
        seriesRef.current = chart.addSeries(CandlestickSeries, {
          upColor: UP,
          downColor: DOWN,
          borderVisible: false,
          wickUpColor: UP,
          wickDownColor: DOWN,
        });
    }
    // Re-apply data to the new series.
    applyData(seriesRef.current, candles, style);
    chart.timeScale().fitContent();
    // `candles` is intentionally not a dependency: the data effect below owns updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [style]);

  // Push data whenever candles change.
  useEffect(() => {
    applyData(seriesRef.current, candles, style);
    chartRef.current?.timeScale().fitContent();
  }, [candles, style]);

  return (
    <div
      ref={containerRef}
      data-testid={testId}
      data-ticker={ticker}
      data-style={style}
      data-point-count={candles.length}
      className="h-full w-full"
    />
  );
}

function applyData(
  series: ISeriesApi<SeriesType> | null,
  candles: Candle[],
  style: ChartStyle,
) {
  if (!series) return;
  if (style === "line" || style === "area") {
    series.setData(
      candles.map((c) => ({ time: c.time as UTCTimestamp, value: c.close })),
    );
  } else {
    series.setData(
      candles.map((c) => ({
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    );
  }
}
