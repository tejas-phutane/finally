"""Tests for Yahoo candle parsing (no network calls)."""

from unittest.mock import patch

import pandas as pd
import pytest

from app.market.history import fetch_candles


def _frame(rows):
    """Build a frame shaped like yf.download() output for one ticker: (Price, Ticker) columns."""
    idx = pd.to_datetime([r[0] for r in rows]).tz_localize("UTC")
    cols = pd.MultiIndex.from_tuples(
        [("Open", "AAPL"), ("High", "AAPL"), ("Low", "AAPL"), ("Close", "AAPL"), ("Volume", "AAPL")]
    )
    data = [[r[1], r[2], r[3], r[4], r[5]] for r in rows]
    return pd.DataFrame(data, index=idx, columns=cols)


def test_parses_ohlcv_oldest_first():
    frame = _frame(
        [
            ("2026-11-09 10:00", 100.0, 101.0, 99.5, 100.5, 1000),
            ("2026-11-09 10:01", 100.5, 102.0, 100.0, 101.5, 2000),
        ]
    )
    with patch("app.market.history.yf.download", return_value=frame):
        candles = fetch_candles("AAPL", "1D")

    assert [c["close"] for c in candles] == [100.5, 101.5]
    first = candles[0]
    assert first["open"] == 100.0 and first["high"] == 101.0 and first["low"] == 99.5
    assert first["volume"] == 1000.0
    assert isinstance(first["time"], int)
    assert candles[1]["time"] - candles[0]["time"] == 60


def test_skips_rows_without_close():
    frame = _frame(
        [
            ("2026-11-09 10:00", 100.0, 101.0, 99.5, float("nan"), 1000),
            ("2026-11-09 10:01", 100.5, 102.0, 100.0, 101.5, 2000),
        ]
    )
    with patch("app.market.history.yf.download", return_value=frame):
        candles = fetch_candles("AAPL", "1D")
    assert [c["close"] for c in candles] == [101.5]


def test_empty_frame_returns_empty_list():
    with patch("app.market.history.yf.download", return_value=pd.DataFrame()):
        assert fetch_candles("AAPL", "1D") == []


def test_passes_period_and_interval_for_range():
    frame = _frame([("2026-11-09 10:00", 1.0, 1.0, 1.0, 1.0, 1)])
    with patch("app.market.history.yf.download", return_value=frame) as dl:
        fetch_candles("AAPL", "1Y")
    assert dl.call_args.kwargs["period"] == "1y"
    assert dl.call_args.kwargs["interval"] == "1d"


def test_rejects_unsupported_range():
    with pytest.raises(ValueError, match="unsupported range"):
        fetch_candles("AAPL", "2W")
