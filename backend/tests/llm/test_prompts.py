"""Prompt construction: system prompt, portfolio context, history."""

from app.llm.prompts import SYSTEM_PROMPT, build_messages, build_portfolio_text

CONTEXT = {
    "cash_balance": 8000.0,
    "total_value": 10500.0,
    "unrealized_pnl": 500.0,
    "positions": [
        {
            "ticker": "AAPL",
            "quantity": 10,
            "avg_cost": 200.0,
            "current_price": 250.0,
            "market_value": 2500.0,
            "unrealized_pnl": 500.0,
            "pct_change": 25.0,
            "weight": 0.238,
        }
    ],
    "watchlist": [{"ticker": "GOOGL", "price": 175.5}],
}


def test_system_prompt_identifies_assistant():
    assert "FinAlly, an AI trading assistant" in SYSTEM_PROMPT


def test_portfolio_text_includes_cash_and_positions():
    text = build_portfolio_text(CONTEXT)
    assert "Cash balance: $8,000.00" in text
    assert "AAPL" in text
    assert "qty=10.0000" in text
    assert "GOOGL: price=$175.50" in text


def test_portfolio_text_handles_empty_context():
    text = build_portfolio_text({})
    assert "(none)" in text
    assert "(empty)" in text


def test_build_messages_order_and_content():
    history = [
        {"role": "user", "content": "hi"},
        {"role": "assistant", "content": "hello"},
        {"role": "system", "content": "dropped"},
        {"role": "user", "content": ""},
    ]
    msgs = build_messages("buy 1 AAPL", history, CONTEXT)
    assert msgs[0] == {"role": "system", "content": SYSTEM_PROMPT}
    assert "Cash balance: $8,000.00" in msgs[1]["content"]
    assert [m["role"] for m in msgs[2:]] == ["user", "assistant", "user"]
    assert msgs[-1] == {"role": "user", "content": "buy 1 AAPL"}
