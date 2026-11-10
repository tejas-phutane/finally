"""Portfolio trade math, validation, and valuation."""

import pytest

from app import db
from app.market import PriceCache
from app.portfolio import TradeError, execute_trade, get_portfolio, record_snapshot


@pytest.fixture(autouse=True)
def temp_db(tmp_path):
    db.init_db(str(tmp_path / "test.db"))
    yield


@pytest.fixture
def cache():
    c = PriceCache()
    c.update("AAPL", 100.0)
    c.update("MSFT", 50.0)
    return c


def test_fresh_portfolio_is_all_cash(cache):
    p = get_portfolio(cache)
    assert p["cash_balance"] == 10000.0
    assert p["total_value"] == 10000.0
    assert p["unrealized_pnl"] == 0.0
    assert p["positions"] == []


def test_buy_reduces_cash_and_creates_position(cache):
    trade = execute_trade(cache, "AAPL", 10, "buy")
    assert trade["ticker"] == "AAPL"
    assert trade["side"] == "buy"
    assert trade["price"] == 100.0

    p = get_portfolio(cache)
    assert p["cash_balance"] == 9000.0
    assert len(p["positions"]) == 1
    pos = p["positions"][0]
    assert pos["quantity"] == 10
    assert pos["avg_cost"] == 100.0
    assert pos["market_value"] == 1000.0
    assert pos["unrealized_pnl"] == 0.0
    assert p["total_value"] == 10000.0


def test_avg_cost_is_weighted_on_second_buy(cache):
    execute_trade(cache, "AAPL", 10, "buy")  # 10 @ 100
    cache.update("AAPL", 130.0)
    execute_trade(cache, "AAPL", 10, "buy")  # 10 @ 130
    pos = get_portfolio(cache)["positions"][0]
    assert pos["quantity"] == 20
    assert pos["avg_cost"] == pytest.approx(115.0)


def test_sell_at_profit_keeps_avg_cost_and_adds_cash(cache):
    execute_trade(cache, "AAPL", 10, "buy")
    cache.update("AAPL", 120.0)
    execute_trade(cache, "AAPL", 4, "sell")
    p = get_portfolio(cache)
    assert p["cash_balance"] == pytest.approx(9000.0 + 480.0)
    pos = p["positions"][0]
    assert pos["quantity"] == 6
    assert pos["avg_cost"] == 100.0
    assert pos["unrealized_pnl"] == pytest.approx(120.0)


def test_sell_at_loss(cache):
    execute_trade(cache, "AAPL", 10, "buy")
    cache.update("AAPL", 80.0)
    execute_trade(cache, "AAPL", 10, "sell")
    p = get_portfolio(cache)
    assert p["cash_balance"] == pytest.approx(9000.0 + 800.0)
    assert p["positions"] == []  # fully sold -> position deleted


def test_selling_to_zero_deletes_position(cache):
    execute_trade(cache, "MSFT", 2, "buy")
    execute_trade(cache, "MSFT", 2, "sell")
    assert db.get_position("MSFT") is None


def test_buy_with_insufficient_cash_rejected(cache):
    with pytest.raises(TradeError) as exc:
        execute_trade(cache, "AAPL", 101, "buy")  # 10100 > 10000
    assert "Insufficient cash" in exc.value.message
    assert db.get_cash_balance() == 10000.0
    assert db.list_trades() == []


def test_sell_more_than_owned_rejected(cache):
    execute_trade(cache, "AAPL", 5, "buy")
    with pytest.raises(TradeError) as exc:
        execute_trade(cache, "AAPL", 6, "sell")
    assert "Insufficient shares" in exc.value.message
    assert db.get_position("AAPL")["quantity"] == 5


def test_sell_with_no_position_rejected(cache):
    with pytest.raises(TradeError):
        execute_trade(cache, "AAPL", 1, "sell")


def test_no_price_rejected(cache):
    with pytest.raises(TradeError) as exc:
        execute_trade(cache, "ZZZZ", 1, "buy")
    assert "No price" in exc.value.message


@pytest.mark.parametrize("qty", [0, -1, float("nan"), float("inf")])
def test_non_positive_quantity_rejected(cache, qty):
    with pytest.raises(TradeError):
        execute_trade(cache, "AAPL", qty, "buy")


def test_bad_side_rejected(cache):
    with pytest.raises(TradeError):
        execute_trade(cache, "AAPL", 1, "short")


def test_fractional_shares(cache):
    execute_trade(cache, "AAPL", 0.5, "buy")
    p = get_portfolio(cache)
    assert p["positions"][0]["quantity"] == 0.5
    assert p["cash_balance"] == pytest.approx(9950.0)


def test_trade_records_snapshot(cache):
    execute_trade(cache, "AAPL", 10, "buy")
    snaps = db.list_snapshots()
    assert len(snaps) == 1
    assert snaps[0]["total_value"] == pytest.approx(10000.0)


def test_record_snapshot_stores_total(cache):
    execute_trade(cache, "AAPL", 10, "buy")
    cache.update("AAPL", 110.0)
    row = record_snapshot(cache)
    assert row["total_value"] == pytest.approx(9000.0 + 1100.0)


def test_held_ticker_without_price_falls_back_to_cost(cache):
    execute_trade(cache, "AAPL", 10, "buy")
    cache.remove("AAPL")
    pos = get_portfolio(cache)["positions"][0]
    assert pos["current_price"] == 100.0
    assert pos["unrealized_pnl"] == 0.0


def test_weights_sum_to_invested_fraction(cache):
    execute_trade(cache, "AAPL", 10, "buy")  # 1000
    execute_trade(cache, "MSFT", 10, "buy")  # 500
    p = get_portfolio(cache)
    weights = sum(pos["weight"] for pos in p["positions"])
    assert weights == pytest.approx(1500 / 10000)
