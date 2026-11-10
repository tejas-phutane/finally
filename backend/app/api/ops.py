"""Shared operations used by both HTTP routes and the chat handler.

Functions here raise WatchlistError (not HTTPException) so the chat handler can turn
failures into result items instead of HTTP errors.
"""

from __future__ import annotations

import re
from typing import Any

from app import db
from app.market import PriceCache

TICKER_RE = re.compile(r"^[A-Z]{1,10}$")


class WatchlistError(Exception):
    """Watchlist change rejected. `code` is one of: invalid, exists, missing, open_position."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def normalize_ticker(raw: str) -> str:
    """Uppercase and strip. Raises WatchlistError(invalid) if not 1-10 letters."""
    ticker = raw.strip().upper()
    if not TICKER_RE.match(ticker):
        raise WatchlistError("invalid", f"Invalid ticker: {raw!r}")
    return ticker


def track_session_opens(cache: PriceCache, session_open: dict[str, float]) -> None:
    """Record the first price seen per ticker since process start."""
    for ticker, update in cache.get_all().items():
        session_open.setdefault(ticker, update.price)


async def add_watchlist_ticker(source, ticker: str, session_open: dict[str, float], cache: PriceCache) -> None:
    ticker = normalize_ticker(ticker)
    if not db.add_watchlist(ticker):
        raise WatchlistError("exists", f"{ticker} is already in the watchlist")
    await source.add_ticker(ticker)
    track_session_opens(cache, session_open)


async def remove_watchlist_checked(source, ticker: str) -> None:
    """Remove a ticker, refusing if it is absent or has an open position.

    Order matters: check everything first, then mutate, so a rejected removal
    never leaves the DB and market source out of sync.
    """
    ticker = normalize_ticker(ticker)
    if ticker not in db.list_watchlist():
        raise WatchlistError("missing", f"{ticker} is not in the watchlist")
    if db.get_position(ticker) is not None:
        raise WatchlistError("open_position", f"Cannot remove {ticker}: open position")
    db.remove_watchlist(ticker)
    await source.remove_ticker(ticker)


def watchlist_view(cache: PriceCache, session_open: dict[str, float]) -> list[dict[str, Any]]:
    """Watchlist rows with live prices and daily change vs session open."""
    rows: list[dict[str, Any]] = []
    for ticker in db.list_watchlist():
        update = cache.get(ticker)
        open_price = session_open.get(ticker)
        price = update.price if update else None
        day_change = None
        if price is not None and open_price:
            day_change = (price - open_price) / open_price * 100
        rows.append(
            {
                "ticker": ticker,
                "price": price,
                "previous_price": update.previous_price if update else None,
                "change_percent": update.change_percent if update else None,
                "direction": update.direction if update else None,
                "session_open": open_price,
                "day_change_percent": day_change,
                "timestamp": update.timestamp if update else None,
            }
        )
    return rows


def chat_context(cache: PriceCache, session_open: dict[str, float], portfolio: dict[str, Any]) -> dict[str, Any]:
    """Portfolio fields plus a minimal watchlist ({ticker, price}) for the LLM prompt."""
    watchlist = [{"ticker": r["ticker"], "price": r["price"]} for r in watchlist_view(cache, session_open)]
    return {**portfolio, "watchlist": watchlist}
