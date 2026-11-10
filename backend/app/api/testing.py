"""Test-only routes. Mounted only when LLM_MOCK=true (E2E and CI runs)."""

from __future__ import annotations

from fastapi import APIRouter, Request

from app import db

router = APIRouter(prefix="/api/test")


@router.post("/reset")
async def reset(request: Request) -> dict[str, str]:
    """Restore the seeded state: $10k cash, default watchlist, no trades/positions/history."""
    state = request.app.state
    before = set(db.list_watchlist())

    db.reset_to_seed()

    # Keep the market source in step with the restored watchlist.
    defaults = set(db.DEFAULT_TICKERS)
    for ticker in sorted(before - defaults):
        await state.source.remove_ticker(ticker)
    for ticker in sorted(defaults - before):
        await state.source.add_ticker(ticker)
    state.session_open.clear()
    return {"status": "reset"}
