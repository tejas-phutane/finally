"""Tests for the Yahoo Finance market data source (no network calls)."""

import os
from unittest.mock import patch

import pandas as pd
import pytest

from app.market.cache import PriceCache
from app.market.factory import create_market_data_source
from app.market.yahoo_client import YahooDataSource, download_last_prices


def _fake_download_frame(data: dict[str, list[float]], index: list[pd.Timestamp]) -> pd.DataFrame:
    """Build a frame shaped like yf.download() output: columns (Price, Ticker)."""
    cols = pd.MultiIndex.from_tuples([("Close", t) for t in data])
    return pd.DataFrame(
        {("Close", t): values for t, values in data.items()},
        index=index,
        columns=cols,
    )


class TestDownloadParsing:
    def test_takes_last_non_nan_close_per_ticker(self):
        idx = pd.to_datetime(["2026-11-09 10:00", "2026-11-09 10:01"]).tz_localize("UTC")
        frame = _fake_download_frame(
            {"AAPL": [100.0, 101.5], "MSFT": [200.0, float("nan")]}, list(idx)
        )
        with patch("app.market.yahoo_client.yf.download", return_value=frame):
            quotes = download_last_prices(["AAPL", "MSFT"])

        assert quotes["AAPL"][0] == pytest.approx(101.5)
        assert quotes["AAPL"][1] == pytest.approx(idx[1].timestamp())
        # MSFT's last bar is NaN, so its last real close (200.0) is used
        assert quotes["MSFT"][0] == pytest.approx(200.0)

    def test_missing_ticker_is_omitted(self):
        idx = pd.to_datetime(["2026-11-09 10:00"]).tz_localize("UTC")
        frame = _fake_download_frame({"AAPL": [100.0]}, list(idx))
        with patch("app.market.yahoo_client.yf.download", return_value=frame):
            quotes = download_last_prices(["AAPL", "ZZZZ"])
        assert set(quotes) == {"AAPL"}

    def test_empty_frame_returns_no_quotes(self):
        with patch("app.market.yahoo_client.yf.download", return_value=pd.DataFrame()):
            assert download_last_prices(["AAPL"]) == {}

    def test_no_tickers_skips_network(self):
        with patch("app.market.yahoo_client.yf.download") as dl:
            assert download_last_prices([]) == {}
        dl.assert_not_called()


class TestYahooDataSource:
    async def test_start_writes_quotes_to_cache(self):
        cache = PriceCache()
        calls = []

        def fake_fetch(tickers):
            calls.append(list(tickers))
            return {"AAPL": (190.5, 1_700_000_000.0)}

        source = YahooDataSource(price_cache=cache, poll_interval=60, fetch=fake_fetch)
        await source.start(["aapl", "msft"])
        try:
            assert calls == [["AAPL", "MSFT"]]
            assert cache.get_price("AAPL") == pytest.approx(190.5)
            assert cache.get_price("MSFT") is None  # no quote for MSFT in the fake
        finally:
            await source.stop()

    async def test_fetch_error_does_not_raise(self):
        cache = PriceCache()

        def boom(_tickers):
            raise RuntimeError("yahoo down")

        source = YahooDataSource(price_cache=cache, poll_interval=60, fetch=boom)
        await source.start(["AAPL"])  # must not raise
        await source.stop()
        assert cache.get_price("AAPL") is None

    async def test_add_and_remove_ticker(self):
        cache = PriceCache()
        source = YahooDataSource(
            price_cache=cache, poll_interval=60, fetch=lambda t: {x: (1.0, 0.0) for x in t}
        )
        await source.start(["AAPL"])
        try:
            await source.add_ticker("pypl")
            assert source.get_tickers() == ["AAPL", "PYPL"]
            await source.remove_ticker("AAPL")
            assert source.get_tickers() == ["PYPL"]
            assert cache.get_price("AAPL") is None
        finally:
            await source.stop()


class TestFactoryYahoo:
    def test_explicit_yahoo_provider(self):
        with patch.dict(os.environ, {"MARKET_DATA_PROVIDER": "yahoo"}, clear=True):
            source = create_market_data_source(PriceCache())
        assert isinstance(source, YahooDataSource)

    def test_unknown_provider_raises(self):
        with patch.dict(os.environ, {"MARKET_DATA_PROVIDER": "bloomberg"}, clear=True):
            with pytest.raises(ValueError, match="Unknown MARKET_DATA_PROVIDER"):
                create_market_data_source(PriceCache())
