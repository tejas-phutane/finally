"""Pydantic models for the LLM structured-output contract."""

from typing import Literal

from pydantic import BaseModel


class TradeInstruction(BaseModel):
    ticker: str
    side: Literal["buy", "sell"]
    quantity: float


class WatchlistChange(BaseModel):
    ticker: str
    action: Literal["add", "remove"]


class LLMResponse(BaseModel):
    message: str
    trades: list[TradeInstruction] = []
    watchlist_changes: list[WatchlistChange] = []
