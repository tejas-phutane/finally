"""REST routes under /api (SSE stream is mounted separately from app.market)."""

from __future__ import annotations

import asyncio
import re
from typing import Any, Literal

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from app import db
from app.api import ops
from app.api.ops import WatchlistError
from app.llm import client as llm_client
from app.market.history import RANGES, fetch_candles, range_interval
from app.portfolio import TradeError, execute_trade, get_portfolio

router = APIRouter(prefix="/api")


class TradeRequest(BaseModel):
    ticker: str
    quantity: float  # positivity checked in execute_trade so rejections are 400s
    side: Literal["buy", "sell"]


class WatchlistRequest(BaseModel):
    ticker: str


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)


def _state(request: Request):
    return request.app.state


def _watchlist_http_error(exc: WatchlistError) -> HTTPException:
    status = {"invalid": 400, "exists": 409, "missing": 404, "open_position": 409}[exc.code]
    return HTTPException(status_code=status, detail=exc.message)


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


# ---- Portfolio -------------------------------------------------------------


@router.get("/portfolio")
async def portfolio(request: Request) -> dict[str, Any]:
    return get_portfolio(_state(request).cache)


@router.post("/portfolio/trade")
async def trade(body: TradeRequest, request: Request) -> dict[str, Any]:
    state = _state(request)
    ticker = body.ticker.strip().upper()
    try:
        trade_row = execute_trade(state.cache, ticker, body.quantity, body.side)
    except TradeError as exc:
        raise HTTPException(status_code=400, detail=exc.message) from exc
    return {"trade": trade_row, "portfolio": get_portfolio(state.cache)}


@router.get("/portfolio/history")
async def portfolio_history() -> list[dict[str, Any]]:
    return db.list_snapshots()


# ---- Watchlist -------------------------------------------------------------


@router.get("/watchlist")
async def watchlist(request: Request) -> list[dict[str, Any]]:
    state = _state(request)
    ops.track_session_opens(state.cache, state.session_open)
    return ops.watchlist_view(state.cache, state.session_open)


@router.post("/watchlist")
async def add_watchlist(body: WatchlistRequest, request: Request) -> list[dict[str, Any]]:
    state = _state(request)
    try:
        await ops.add_watchlist_ticker(state.source, body.ticker, state.session_open, state.cache)
    except WatchlistError as exc:
        raise _watchlist_http_error(exc) from exc
    return ops.watchlist_view(state.cache, state.session_open)


@router.delete("/watchlist/{ticker}")
async def remove_watchlist(ticker: str, request: Request) -> list[dict[str, Any]]:
    state = _state(request)
    try:
        await ops.remove_watchlist_checked(state.source, ticker)
    except WatchlistError as exc:
        raise _watchlist_http_error(exc) from exc
    return ops.watchlist_view(state.cache, state.session_open)


# ---- Chat ------------------------------------------------------------------


@router.get("/market/candles")
async def market_candles(ticker: str, range: str = "1D") -> dict[str, Any]:
    """OHLC candles for one ticker over a range (Yahoo via yfinance). Oldest first."""
    symbol = ticker.strip().upper()
    if not re.fullmatch(r"[A-Z]{1,10}", symbol):
        raise HTTPException(status_code=400, detail="invalid ticker")
    if range not in RANGES:
        raise HTTPException(status_code=400, detail=f"range must be one of {', '.join(RANGES)}")
    try:
        candles = await asyncio.to_thread(fetch_candles, symbol, range)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"candle fetch failed: {e}") from e
    return {
        "ticker": symbol,
        "range": range,
        "interval": range_interval(range),
        "candles": candles,
    }


@router.get("/chat/history")
async def chat_history() -> list[dict[str, Any]]:
    return db.list_chat_messages(limit=200)


@router.post("/chat")
async def chat(body: ChatRequest, request: Request) -> dict[str, Any]:
    state = _state(request)
    history = [{"role": m["role"], "content": m["content"]} for m in db.list_chat_messages(limit=20)]
    context = ops.chat_context(state.cache, state.session_open, get_portfolio(state.cache))

    db.insert_chat_message("user", body.message)
    reply = await llm_client.chat_completion(body.message, history, context)

    trade_results: list[dict[str, Any]] = []
    for t in reply.trades:
        ticker = t.ticker.strip().upper()
        try:
            row = execute_trade(state.cache, ticker, t.quantity, t.side)
            trade_results.append(
                {"ticker": ticker, "side": t.side, "quantity": t.quantity,
                 "status": "executed", "price": row["price"]}
            )
        except TradeError as exc:
            trade_results.append(
                {"ticker": ticker, "side": t.side, "quantity": t.quantity,
                 "status": "failed", "error": exc.message}
            )

    watchlist_results: list[dict[str, Any]] = []
    for c in reply.watchlist_changes:
        ticker = c.ticker.strip().upper()
        try:
            if c.action == "add":
                await ops.add_watchlist_ticker(state.source, ticker, state.session_open, state.cache)
            else:
                await ops.remove_watchlist_checked(state.source, ticker)
            watchlist_results.append({"ticker": ticker, "action": c.action, "status": "executed"})
        except WatchlistError as exc:
            watchlist_results.append(
                {"ticker": ticker, "action": c.action, "status": "failed", "error": exc.message}
            )

    actions = {"trades": trade_results, "watchlist_changes": watchlist_results}
    db.insert_chat_message("assistant", reply.message, actions=actions)
    return {"message": reply.message, "trades": trade_results, "watchlist_changes": watchlist_results}
