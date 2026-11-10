"""Deterministic mock responses used when LLM_MOCK=true. No network access."""

import re

from app.llm.schemas import LLMResponse, TradeInstruction, WatchlistChange

_TRADE_RE = re.compile(r"(buy|sell)\s+(\d+(?:\.\d+)?)\s+([A-Za-z]{1,10})", re.IGNORECASE)
_WATCH_ADD_RE = re.compile(r"(add|watch)\s+([A-Za-z]{1,10})", re.IGNORECASE)
_WATCH_REMOVE_RE = re.compile(r"remove\s+([A-Za-z]{1,10})", re.IGNORECASE)


def mock_response(user_message: str) -> LLMResponse:
    """Return a response based on simple fixed patterns; echo the input otherwise."""
    text = user_message.strip()

    m = _TRADE_RE.fullmatch(text)
    if m:
        side, qty, ticker = m.group(1).lower(), float(m.group(2)), m.group(3).upper()
        return LLMResponse(
            message=f"Mock: {side} {qty:g} {ticker}.",
            trades=[TradeInstruction(ticker=ticker, side=side, quantity=qty)],
        )

    m = _WATCH_ADD_RE.fullmatch(text)
    if m:
        ticker = m.group(2).upper()
        return LLMResponse(
            message=f"Mock: added {ticker} to the watchlist.",
            watchlist_changes=[WatchlistChange(ticker=ticker, action="add")],
        )

    m = _WATCH_REMOVE_RE.fullmatch(text)
    if m:
        ticker = m.group(1).upper()
        return LLMResponse(
            message=f"Mock: removed {ticker} from the watchlist.",
            watchlist_changes=[WatchlistChange(ticker=ticker, action="remove")],
        )

    return LLMResponse(message=f"Mock response: {user_message}")
