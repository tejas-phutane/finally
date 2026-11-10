"""System prompt and message construction for the chat assistant."""

from typing import Any

SYSTEM_PROMPT = """You are FinAlly, an AI trading assistant embedded in a trading workstation.

You can see the user's portfolio (cash, positions with P&L, watchlist with live prices).
Your job:
- Analyze portfolio composition, risk concentration, and P&L when asked or when relevant.
- Suggest trades with brief reasoning.
- Execute trades (buy/sell market orders) when the user asks for them or agrees to your suggestion.
- Manage the watchlist proactively (add/remove tickers) when it helps the user.
- Be concise and data-driven. Use the numbers from the portfolio context.
- This is a simulated environment with virtual money. Trades fill instantly at the current price.

Always respond with a single valid JSON object matching this schema, and nothing else:
{
  "message": "your conversational reply to the user",
  "trades": [{"ticker": "AAPL", "side": "buy", "quantity": 10}],
  "watchlist_changes": [{"ticker": "PYPL", "action": "add"}]
}
- "message" is required.
- "trades" and "watchlist_changes" are optional; use empty lists when there is nothing to do.
- side is "buy" or "sell". action is "add" or "remove". quantity is a positive number.
- Only trade tickers the user asked about or that you proposed and the user agreed to.
"""


def _fmt_num(value: Any, digits: int = 2) -> str:
    if value is None:
        return "n/a"
    try:
        return f"{float(value):,.{digits}f}"
    except (TypeError, ValueError):
        return str(value)


def build_portfolio_text(portfolio_context: dict) -> str:
    """Render the portfolio context dict as plain text for the LLM."""
    lines = [
        f"Cash balance: ${_fmt_num(portfolio_context.get('cash_balance'))}",
        f"Total portfolio value: ${_fmt_num(portfolio_context.get('total_value'))}",
        f"Unrealized P&L: ${_fmt_num(portfolio_context.get('unrealized_pnl'))}",
        "",
        "Positions:",
    ]
    positions = portfolio_context.get("positions") or []
    if not positions:
        lines.append("  (none)")
    for p in positions:
        lines.append(
            f"  {p.get('ticker')}: qty={_fmt_num(p.get('quantity'), 4)}, "
            f"avg_cost=${_fmt_num(p.get('avg_cost'))}, "
            f"price=${_fmt_num(p.get('current_price'))}, "
            f"market_value=${_fmt_num(p.get('market_value'))}, "
            f"unrealized_pnl=${_fmt_num(p.get('unrealized_pnl'))}, "
            f"pct_change={_fmt_num(p.get('pct_change'))}%, "
            f"weight={_fmt_num(p.get('weight'), 4)}"
        )

    lines.append("")
    lines.append("Watchlist:")
    watchlist = portfolio_context.get("watchlist") or []
    if not watchlist:
        lines.append("  (empty)")
    for w in watchlist:
        lines.append(f"  {w.get('ticker')}: price=${_fmt_num(w.get('price'))}")
    return "\n".join(lines)


def build_messages(
    user_message: str,
    history: list[dict],
    portfolio_context: dict,
) -> list[dict]:
    """Build the LiteLLM message list: system, portfolio context, history, new message."""
    messages: list[dict] = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {
            "role": "system",
            "content": "Current portfolio context:\n" + build_portfolio_text(portfolio_context),
        },
    ]
    for item in history:
        role = item.get("role")
        content = item.get("content")
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": user_message})
    return messages
