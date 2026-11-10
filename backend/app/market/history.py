"""Historical OHLC candles from Yahoo Finance (via yfinance)."""

from __future__ import annotations

from typing import Any

import pandas as pd
import yfinance as yf

# interval -> yfinance period that covers one session of bars
INTERVAL_PERIOD = {"1m": "1d", "5m": "5d"}


def fetch_candles(ticker: str, interval: str = "1m") -> list[dict[str, Any]]:
    """Return OHLCV candles for one ticker, oldest first.

    Each candle: {"time": unix_seconds, "open", "high", "low", "close", "volume"}.
    Blocking call — run it in a thread. Returns [] when Yahoo has no bars.
    """
    if interval not in INTERVAL_PERIOD:
        raise ValueError(f"unsupported interval {interval!r}")
    df = yf.download(
        ticker,
        period=INTERVAL_PERIOD[interval],
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
