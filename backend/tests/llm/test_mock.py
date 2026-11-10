"""Deterministic mock rules (LLM_MOCK=true)."""

from app.llm.mock import mock_response


def test_buy_pattern():
    r = mock_response("buy 10 AAPL")
    assert len(r.trades) == 1
    assert (r.trades[0].ticker, r.trades[0].side, r.trades[0].quantity) == ("AAPL", "buy", 10)
    assert r.watchlist_changes == []


def test_sell_pattern_fractional_and_case_insensitive():
    r = mock_response("Sell 2.5 nvda")
    assert len(r.trades) == 1
    assert (r.trades[0].ticker, r.trades[0].side, r.trades[0].quantity) == ("NVDA", "sell", 2.5)


def test_add_pattern():
    r = mock_response("add PYPL")
    assert r.trades == []
    assert len(r.watchlist_changes) == 1
    assert (r.watchlist_changes[0].ticker, r.watchlist_changes[0].action) == ("PYPL", "add")


def test_watch_pattern():
    r = mock_response("watch pypl")
    assert (r.watchlist_changes[0].ticker, r.watchlist_changes[0].action) == ("PYPL", "add")


def test_remove_pattern():
    r = mock_response("remove TSLA")
    assert (r.watchlist_changes[0].ticker, r.watchlist_changes[0].action) == ("TSLA", "remove")


def test_fallback_echoes_input_without_actions():
    r = mock_response("how is my portfolio?")
    assert "how is my portfolio?" in r.message
    assert r.trades == []
    assert r.watchlist_changes == []


def test_partial_pattern_falls_back():
    r = mock_response("buy AAPL")  # no quantity
    assert r.trades == []
