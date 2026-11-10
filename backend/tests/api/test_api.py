"""HTTP API: status codes, response shapes, and chat flow."""

import pytest
from fastapi.testclient import TestClient

from app import db
from app.llm.schemas import LLMResponse, TradeInstruction, WatchlistChange


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("FINALLY_DB_PATH", str(tmp_path / "api.db"))
    monkeypatch.setenv("FINALLY_STATIC_DIR", str(tmp_path / "no-static"))
    monkeypatch.setenv("MARKET_DATA_PROVIDER", "simulator")  # force the simulator
    from app.main import create_app

    with TestClient(create_app()) as c:
        # Deterministic prices for trade assertions.
        c.app.state.cache.update("AAPL", 100.0)
        c.app.state.cache.update("MSFT", 50.0)
        yield c


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_portfolio_initial(client):
    r = client.get("/api/portfolio")
    assert r.status_code == 200
    body = r.json()
    assert body["cash_balance"] == 10000.0
    assert body["total_value"] == 10000.0
    assert body["positions"] == []


def test_buy_returns_trade_and_portfolio(client):
    r = client.post("/api/portfolio/trade", json={"ticker": "aapl", "quantity": 10, "side": "buy"})
    assert r.status_code == 200
    body = r.json()
    assert body["trade"]["ticker"] == "AAPL"
    assert body["trade"]["price"] == 100.0
    assert body["portfolio"]["cash_balance"] == 9000.0
    assert body["portfolio"]["positions"][0]["ticker"] == "AAPL"


def test_trade_insufficient_cash_is_400(client):
    r = client.post("/api/portfolio/trade", json={"ticker": "AAPL", "quantity": 1000, "side": "buy"})
    assert r.status_code == 400
    assert "Insufficient cash" in r.json()["detail"]


def test_sell_without_position_is_400(client):
    r = client.post("/api/portfolio/trade", json={"ticker": "AAPL", "quantity": 1, "side": "sell"})
    assert r.status_code == 400


def test_trade_zero_quantity_is_400(client):
    r = client.post("/api/portfolio/trade", json={"ticker": "AAPL", "quantity": 0, "side": "buy"})
    assert r.status_code == 400


def test_trade_unknown_ticker_is_400(client):
    r = client.post("/api/portfolio/trade", json={"ticker": "NOPE", "quantity": 1, "side": "buy"})
    assert r.status_code == 400
    assert "No price" in r.json()["detail"]


def test_trade_bad_side_is_422(client):
    r = client.post("/api/portfolio/trade", json={"ticker": "AAPL", "quantity": 1, "side": "short"})
    assert r.status_code == 422


def test_history_has_snapshots(client):
    client.post("/api/portfolio/trade", json={"ticker": "AAPL", "quantity": 1, "side": "buy"})
    r = client.get("/api/portfolio/history")
    assert r.status_code == 200
    rows = r.json()
    assert len(rows) >= 2  # startup snapshot + trade snapshot
    assert set(rows[0]) == {"total_value", "recorded_at"}


def test_watchlist_defaults(client):
    r = client.get("/api/watchlist")
    assert r.status_code == 200
    tickers = [row["ticker"] for row in r.json()]
    assert "AAPL" in tickers and len(tickers) == 10
    row = next(x for x in r.json() if x["ticker"] == "AAPL")
    assert set(row) >= {"price", "previous_price", "session_open", "day_change_percent", "direction"}


def test_watchlist_add_and_duplicate(client):
    r = client.post("/api/watchlist", json={"ticker": "pypl"})
    assert r.status_code == 200
    assert "PYPL" in [row["ticker"] for row in r.json()]

    dup = client.post("/api/watchlist", json={"ticker": "PYPL"})
    assert dup.status_code == 409


def test_watchlist_add_invalid_is_400(client):
    for bad in ["", "abc1", "TOOLONGTICKERX", "A B"]:
        r = client.post("/api/watchlist", json={"ticker": bad})
        assert r.status_code == 400, bad


def test_watchlist_remove(client):
    r = client.delete("/api/watchlist/NFLX")
    assert r.status_code == 200
    assert "NFLX" not in [row["ticker"] for row in r.json()]


def test_watchlist_remove_missing_is_404(client):
    r = client.delete("/api/watchlist/PYPL")
    assert r.status_code == 404


def test_watchlist_remove_with_open_position_is_409(client):
    client.post("/api/portfolio/trade", json={"ticker": "AAPL", "quantity": 1, "side": "buy"})
    r = client.delete("/api/watchlist/AAPL")
    assert r.status_code == 409
    assert "AAPL" in [row["ticker"] for row in client.get("/api/watchlist").json()]


def test_watchlist_remove_after_position_closed(client):
    client.post("/api/portfolio/trade", json={"ticker": "AAPL", "quantity": 1, "side": "buy"})
    client.post("/api/portfolio/trade", json={"ticker": "AAPL", "quantity": 1, "side": "sell"})
    r = client.delete("/api/watchlist/AAPL")
    assert r.status_code == 200


def test_session_open_is_first_seen_price(client):
    # Pin the session open (the simulator may already have ticked AAPL) and check
    # that later prices don't overwrite it.
    client.app.state.session_open["AAPL"] = 100.0
    client.app.state.cache.update("AAPL", 110.0)
    row = next(x for x in client.get("/api/watchlist").json() if x["ticker"] == "AAPL")
    assert row["session_open"] == 100.0
    assert row["day_change_percent"] == pytest.approx(10.0)


def test_chat_history_empty(client):
    r = client.get("/api/chat/history")
    assert r.status_code == 200
    assert r.json() == []


def test_chat_executes_trades_and_watchlist(client, monkeypatch):
    async def fake(user_message, history, portfolio_context):
        return LLMResponse(
            message="Bought and watched.",
            trades=[
                TradeInstruction(ticker="AAPL", side="buy", quantity=2),
                TradeInstruction(ticker="AAPL", side="sell", quantity=5),  # fails: no shares
            ],
            watchlist_changes=[
                WatchlistChange(ticker="PYPL", action="add"),
                WatchlistChange(ticker="NFLX", action="remove"),  # ok: no position
                WatchlistChange(ticker="AAPL", action="remove"),  # fails: open position
            ],
        )

    monkeypatch.setattr("app.llm.client.chat_completion", fake)
    r = client.post("/api/chat", json={"message": "buy 2 aapl"})
    assert r.status_code == 200
    body = r.json()
    assert body["message"] == "Bought and watched."
    assert body["trades"][0]["status"] == "executed"
    assert body["trades"][0]["price"] == 100.0
    assert body["trades"][1]["status"] == "failed"
    assert "Insufficient shares" in body["trades"][1]["error"]
    statuses = [w["status"] for w in body["watchlist_changes"]]
    assert statuses == ["executed", "executed", "failed"]
    assert "open position" in body["watchlist_changes"][2]["error"]

    tickers = [row["ticker"] for row in client.get("/api/watchlist").json()]
    assert "PYPL" in tickers and "NFLX" not in tickers

    history = client.get("/api/chat/history").json()
    assert [m["role"] for m in history] == ["user", "assistant"]
    assert history[1]["actions"]["trades"][0]["status"] == "executed"


def test_chat_passes_history_and_context(client, monkeypatch):
    seen = {}

    async def fake(user_message, history, portfolio_context):
        seen["history"] = history
        seen["context"] = portfolio_context
        return LLMResponse(message="ok")

    monkeypatch.setattr("app.llm.client.chat_completion", fake)
    client.post("/api/chat", json={"message": "first"})
    client.post("/api/chat", json={"message": "second"})

    assert seen["history"] == [{"role": "user", "content": "first"}, {"role": "assistant", "content": "ok"}]
    assert seen["context"]["cash_balance"] == 10000.0
    assert seen["context"]["total_value"] == 10000.0
    assert "positions" in seen["context"] and "unrealized_pnl" in seen["context"]
    assert {"ticker": "AAPL", "price": 100.0} in seen["context"]["watchlist"]


def test_chat_empty_message_is_422(client):
    r = client.post("/api/chat", json={"message": ""})
    assert r.status_code == 422


def test_chat_stores_actions_as_dict(client, monkeypatch):
    async def fake(user_message, history, portfolio_context):
        return LLMResponse(message="hi")

    monkeypatch.setattr("app.llm.client.chat_completion", fake)
    client.post("/api/chat", json={"message": "hello"})
    assert db.list_chat_messages()[-1]["actions"] == {"trades": [], "watchlist_changes": []}


def test_stream_route_mounted(client):
    paths = {route.path for route in client.app.routes}
    assert "/api/stream/prices" in paths


def test_api_only_when_static_dir_missing(client):
    # No static dir configured, so the app still serves the API.
    assert client.get("/api/health").status_code == 200
    assert client.get("/").status_code == 404
