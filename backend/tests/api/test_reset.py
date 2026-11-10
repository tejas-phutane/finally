"""POST /api/test/reset: only mounted when LLM_MOCK=true; restores seeded state."""

import pytest
from fastapi.testclient import TestClient

from app.llm.schemas import LLMResponse, TradeInstruction, WatchlistChange


def _make_client(tmp_path, monkeypatch, llm_mock: str):
    monkeypatch.setenv("FINALLY_DB_PATH", str(tmp_path / "reset.db"))
    monkeypatch.setenv("FINALLY_STATIC_DIR", str(tmp_path / "no-static"))
    monkeypatch.setenv("MARKET_DATA_PROVIDER", "simulator")
    monkeypatch.setenv("LLM_MOCK", llm_mock)
    from app.main import create_app

    return create_app()


@pytest.fixture
def mock_client(tmp_path, monkeypatch):
    with TestClient(_make_client(tmp_path, monkeypatch, "true")) as c:
        c.app.state.cache.update("AAPL", 100.0)
        yield c


def test_reset_route_absent_without_llm_mock(tmp_path, monkeypatch):
    with TestClient(_make_client(tmp_path, monkeypatch, "false")) as c:
        assert c.post("/api/test/reset").status_code == 404


def test_reset_restores_seeded_state(mock_client, monkeypatch):
    c = mock_client

    # Dirty the state: trade, add and remove watchlist tickers, chat, snapshot history.
    c.post("/api/portfolio/trade", json={"ticker": "AAPL", "quantity": 10, "side": "buy"})
    c.post("/api/watchlist", json={"ticker": "PYPL"})
    c.delete("/api/watchlist/NFLX")

    async def fake(user_message, history, portfolio_context):
        return LLMResponse(message="hi", trades=[TradeInstruction(ticker="AAPL", side="sell", quantity=1)],
                           watchlist_changes=[WatchlistChange(ticker="PYPL", action="remove")])

    monkeypatch.setattr("app.llm.client.chat_completion", fake)
    c.post("/api/chat", json={"message": "sell"})

    r = c.post("/api/test/reset")
    assert r.status_code == 200
    assert r.json() == {"status": "reset"}

    portfolio = c.get("/api/portfolio").json()
    assert portfolio["cash_balance"] == 10000.0
    assert portfolio["positions"] == []

    tickers = [row["ticker"] for row in c.get("/api/watchlist").json()]
    assert len(tickers) == 10
    assert "NFLX" in tickers and "PYPL" not in tickers

    assert c.get("/api/chat/history").json() == []
    history = c.get("/api/portfolio/history").json()
    assert history == []


def test_reset_keeps_market_source_in_sync(mock_client):
    c = mock_client
    c.post("/api/watchlist", json={"ticker": "PYPL"})
    c.delete("/api/watchlist/NFLX")
    c.post("/api/test/reset")

    source_tickers = set(c.app.state.source.get_tickers())
    assert "NFLX" in source_tickers
    assert "PYPL" not in source_tickers


def test_reset_is_repeatable(mock_client):
    c = mock_client
    assert c.post("/api/test/reset").status_code == 200
    assert c.post("/api/test/reset").status_code == 200
    assert len(c.get("/api/watchlist").json()) == 10
