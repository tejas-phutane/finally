"""Historical OHLC candles from Yahoo Finance (via yfinance)."""

from __future__ import annotations

from typing import Any

import pandas as pd
import yfinance as yf

# range key -> (yfinance period, bar interval). Bar sizes are chosen so each
# range stays within Yahoo's limits and gives a readable number of candles.
RANGES: dict[str, tuple[str, str]] = {
    "1D": ("1d", "1m"),
    "5D": ("5d", "5m"),
    "1M": ("1mo", "1h"),
    "3M": ("3mo", "1d"),
    "6M": ("6mo", "1d"),
    "1Y": ("1y", "1d"),
    "5Y": ("5y", "1wk"),
}


def range_interval(range_key: str) -> str:
    """Bar interval (e.g. '1m', '1d') used for a range key."""
    if range_key not in RANGES:
        raise ValueError(f"unsupported range {range_key!r}")
    return RANGES[range_key][1]


def fetch_candles(ticker: str, range_key: str = "1D") -> list[dict[str, Any]]:
    """Return OHLCV candles for one ticker over a range, oldest first.

    Each candle: {"time": unix_seconds, "open", "high", "low", "close", "volume"}.
    Blocking call — run it in a thread. Returns [] when Yahoo has no bars.
    """
    period, interval = RANGES[range_key] if range_key in RANGES else (None, None)
    if period is None:
        raise ValueError(f"unsupported range {range_key!r}")
    df = yf.download(
        ticker,
        period=period,
        interval=interval,
        progress=False,
        auto_adjust=False,
        threads=False,
    )
    if df is None or df.empty:
        return []
    if isinstance(df.columns, pd.MultiIndex):
        # yf.download returns (Price, Ticker) columns even for one ticker
        df.columns = df.columns.get_level_values(0)

    candles: list[dict[str, Any]] = []
    for ts, row in df.iterrows():
        if pd.isna(row["Close"]):
            continue
        candles.append(
            {
                "time": int(ts.timestamp()),
                "open": float(row["Open"]),
                "high": float(row["High"]),
                "low": float(row["Low"]),
                "close": float(row["Close"]),
                "volume": float(row["Volume"]) if not pd.isna(row["Volume"]) else 0.0,
            }
        )
    return candles
