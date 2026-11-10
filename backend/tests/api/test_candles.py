"""GET /api/market/candles: validation, shape, and upstream failure."""

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("FINALLY_DB_PATH", str(tmp_path / "candles.db"))
    monkeypatch.setenv("FINALLY_STATIC_DIR", str(tmp_path / "no-static"))
    monkeypatch.setenv("MARKET_DATA_PROVIDER", "simulator")
    from app.main import create_app

    with TestClient(create_app()) as c:
        yield c


def test_returns_candles_shape(client, monkeypatch):
    calls = []

    def fake(ticker, range_key):
        calls.append((ticker, range_key))
        return [{"time": 1, "open": 1.0, "high": 2.0, "low": 0.5, "close": 1.5, "volume": 10.0}]

    monkeypatch.setattr("app.api.routes.fetch_candles", fake)
    r = client.get("/api/market/candles", params={"ticker": "aapl", "range": "5D"})
    assert r.status_code == 200
    assert calls == [("AAPL", "5D")]
    body = r.json()
    assert body["ticker"] == "AAPL" and body["range"] == "5D" and body["interval"] == "5m"
    assert body["candles"][0]["close"] == 1.5


def test_default_range_is_1d(client, monkeypatch):
    seen = {}
    monkeypatch.setattr(
        "app.api.routes.fetch_candles", lambda t, r: seen.update(range=r) or []
    )
    r = client.get("/api/market/candles", params={"ticker": "MSFT"})
    assert r.status_code == 200 and seen["range"] == "1D"


@pytest.mark.parametrize("ticker", ["", "AAPL1", "A-B", "TOOLONGTICKERX"])
def test_invalid_ticker_is_400(client, ticker):
    r = client.get("/api/market/candles", params={"ticker": ticker})
    assert r.status_code == 400


def test_invalid_range_is_400(client):
    r = client.get("/api/market/candles", params={"ticker": "AAPL", "range": "2W"})
    assert r.status_code == 400


def test_upstream_failure_is_502(client, monkeypatch):
    def boom(ticker, interval):
        raise RuntimeError("yahoo down")

    monkeypatch.setattr("app.api.routes.fetch_candles", boom)
    r = client.get("/api/market/candles", params={"ticker": "AAPL"})
    assert r.status_code == 502
    assert "yahoo down" in r.json()["detail"]
