"""Yahoo Finance market data source (via the yfinance library).

yfinance is an unofficial wrapper around Yahoo's public endpoints. It needs no
API key, but Yahoo does not guarantee it and its terms restrict some uses, so
treat it as a convenience source, not a production feed.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

import yfinance as yf

from .cache import PriceCache
from .interface import MarketDataSource

logger = logging.getLogger(__name__)


def download_last_prices(tickers: list[str]) -> dict[str, tuple[float, float]]:
    """Fetch the latest 1-minute close for each ticker in ONE request.

    Returns {ticker: (price, unix_timestamp_seconds)} for tickers that have data.
    Blocking call — run it in a thread.
    """
    if not tickers:
        return {}
    df = yf.download(
        tickers,
        period="1d",
        interval="1m",
        progress=False,
        auto_adjust=False,
        threads=False,
    )
    if df is None or df.empty:
        return {}

    closes = df["Close"]
    result: dict[str, tuple[float, float]] = {}
    for ticker in tickers:
        if ticker not in closes.columns:
            continue
        series = closes[ticker].dropna()
        if series.empty:
            continue
        price = float(series.iloc[-1])
        timestamp = float(series.index[-1].timestamp())
        result[ticker] = (price, timestamp)
    return result


class YahooDataSource(MarketDataSource):
    """MarketDataSource backed by Yahoo Finance quotes, polled in batches."""

    def __init__(
        self,
        price_cache: PriceCache,
        poll_interval: float = 15.0,
        fetch: Any = None,
    ) -> None:
        self._cache = price_cache
        self._interval = poll_interval
        self._fetch = fetch or download_last_prices  # injectable for tests
        self._tickers: list[str] = []
        self._task: asyncio.Task | None = None

    async def start(self, tickers: list[str]) -> None:
        self._tickers = [t.upper().strip() for t in tickers]
        await self._poll_once()
        self._task = asyncio.create_task(self._poll_loop(), name="yahoo-poller")
        logger.info(
            "Yahoo poller started: %d tickers, %.1fs interval",
            len(self._tickers),
            self._interval,
        )

    async def stop(self) -> None:
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        self._task = None
        logger.info("Yahoo poller stopped")

    async def add_ticker(self, ticker: str) -> None:
        ticker = ticker.upper().strip()
        if ticker not in self._tickers:
            self._tickers.append(ticker)
            logger.info("Yahoo: added ticker %s (will appear on next poll)", ticker)

    async def remove_ticker(self, ticker: str) -> None:
        ticker = ticker.upper().strip()
        self._tickers = [t for t in self._tickers if t != ticker]
        self._cache.remove(ticker)
        logger.info("Yahoo: removed ticker %s", ticker)

    def get_tickers(self) -> list[str]:
        return list(self._tickers)

    # --- Internal ---

    async def _poll_loop(self) -> None:
        while True:
            await asyncio.sleep(self._interval)
            await self._poll_once()

    async def _poll_once(self) -> None:
        if not self._tickers:
            return
        try:
            quotes = await asyncio.to_thread(self._fetch, list(self._tickers))
            for ticker, (price, timestamp) in quotes.items():
                self._cache.update(ticker=ticker, price=price, timestamp=timestamp)
            logger.debug("Yahoo poll: updated %d/%d tickers", len(quotes), len(self._tickers))
        except Exception as e:
            # Keep the loop alive; the next interval retries.
            logger.error("Yahoo poll failed: %s", e)
