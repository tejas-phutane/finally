"""Schema validation for LLMResponse and its nested models."""

import pytest
from pydantic import ValidationError

from app.llm.schemas import LLMResponse, TradeInstruction, WatchlistChange


def test_valid_full_response():
    r = LLMResponse.model_validate_json(
        '{"message": "ok", "trades": [{"ticker": "AAPL", "side": "buy", "quantity": 10}],'
        ' "watchlist_changes": [{"ticker": "PYPL", "action": "add"}]}'
    )
    assert r.message == "ok"
    assert r.trades == [TradeInstruction(ticker="AAPL", side="buy", quantity=10)]
    assert r.watchlist_changes == [WatchlistChange(ticker="PYPL", action="add")]


def test_lists_default_to_empty():
    r = LLMResponse(message="hello")
    assert r.trades == []
    assert r.watchlist_changes == []


def test_missing_message_rejected():
    with pytest.raises(ValidationError):
        LLMResponse.model_validate_json('{"trades": []}')


def test_bad_trade_side_rejected():
    with pytest.raises(ValidationError):
        TradeInstruction(ticker="AAPL", side="short", quantity=1)


def test_bad_watchlist_action_rejected():
    with pytest.raises(ValidationError):
        WatchlistChange(ticker="AAPL", action="update")


def test_non_numeric_quantity_rejected():
    with pytest.raises(ValidationError):
        TradeInstruction(ticker="AAPL", side="buy", quantity="lots")


def test_extra_fields_ignored():
    r = LLMResponse.model_validate_json('{"message": "hi", "mood": "happy"}')
    assert r.message == "hi"
    assert not hasattr(r, "mood")
