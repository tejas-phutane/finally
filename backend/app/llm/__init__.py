"""LLM chat integration: structured-output schemas and the chat completion client."""

from app.llm.client import chat_completion
from app.llm.schemas import LLMResponse, TradeInstruction, WatchlistChange

__all__ = ["LLMResponse", "TradeInstruction", "WatchlistChange", "chat_completion"]
