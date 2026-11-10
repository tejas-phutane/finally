"""Portfolio logic: trade execution, valuation, and snapshots.

Money values are rounded to cents when written to cash. Prices come from the
shared PriceCache; there is no fee and no order book (market orders only).
"""

from __future__ import annotations

import math
from typing import Any

from app import db
from app.market import PriceCache

EPS = 1e-9


class TradeError(Exception):
    """A trade was rejected. `message` is user-facing."""

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


def execute_trade(cache: PriceCache, ticker: str, quantity: float, side: str) -> dict[str, Any]:
    """Execute a market order at the current cached price.

    Runs atomically in one DB transaction and records a portfolio snapshot afterwards.
    Returns the stored trade row.
    """
    if side not in ("buy", "sell"):
        raise TradeError("Side must be 'buy' or 'sell'")
    if not isinstance(quantity, (int, float)) or not math.isfinite(quantity) or quantity <= 0:
        raise TradeError("Quantity must be a positive number")

    price = cache.get_price(ticker)
    if price is None:
        raise TradeError(f"No price available for {ticker}")

    with db.transaction() as conn:
        cash = db.get_cash_balance(conn=conn)
        position = db.get_position(ticker, conn=conn)
        held = position["quantity"] if position else 0.0

        if side == "buy":
            cost = quantity * price
            if cost > cash + EPS:
                raise TradeError(f"Insufficient cash: need {cost:.2f}, have {cash:.2f}")
            new_qty = held + quantity
            if position:
                new_avg = (held * position["avg_cost"] + cost) / new_qty
            else:
                new_avg = price
            db.upsert_position(ticker, new_qty, new_avg, conn=conn)
            db.set_cash_balance(round(cash - cost, 2), conn=conn)
        else:
            if quantity > held + EPS:
                raise TradeError(f"Insufficient shares: have {held:g}, tried to sell {quantity:g}")
            new_qty = held - quantity
            if new_qty <= EPS:
                db.delete_position(ticker, conn=conn)
            else:
                db.upsert_position(ticker, new_qty, position["avg_cost"], conn=conn)
            db.set_cash_balance(round(cash + quantity * price, 2), conn=conn)

        trade = db.insert_trade(ticker, side, quantity, price, conn=conn)
        _record_snapshot_in(cache, conn)

    return trade


def get_portfolio(cache: PriceCache) -> dict[str, Any]:
    """Current cash, positions with live valuation, and totals."""
    cash = db.get_cash_balance()
    positions = db.list_positions()
    return _value_portfolio(cache, cash, positions)


def record_snapshot(cache: PriceCache) -> dict[str, Any]:
    """Store the current total portfolio value. Returns the stored row."""
    total = get_portfolio(cache)["total_value"]
    return db.insert_snapshot(total)


def _record_snapshot_in(cache: PriceCache, conn) -> dict[str, Any]:
    """Snapshot using the given transaction connection (sees uncommitted writes)."""
    cash = db.get_cash_balance(conn=conn)
    positions = db.list_positions(conn=conn)
    total = _value_portfolio(cache, cash, positions)["total_value"]
    return db.insert_snapshot(total, conn=conn)


def _value_portfolio(cache: PriceCache, cash: float, positions: list[dict]) -> dict[str, Any]:
    rows: list[dict[str, Any]] = []
    market_total = 0.0
    for pos in positions:
        qty = pos["quantity"]
        avg = pos["avg_cost"]
        # Fall back to cost basis if no tick has arrived yet for this ticker.
        price = cache.get_price(pos["ticker"])
        if price is None:
            price = avg
        market_value = qty * price
        market_total += market_value
        rows.append(
            {
                "ticker": pos["ticker"],
                "quantity": qty,
                "avg_cost": avg,
                "current_price": price,
                "market_value": market_value,
                "unrealized_pnl": (price - avg) * qty,
                "pct_change": (price - avg) / avg * 100 if avg > 0 else 0.0,
            }
        )

    total_value = cash + market_total
    for row in rows:
        row["weight"] = row["market_value"] / total_value if total_value > 0 else 0.0

    return {
        "cash_balance": cash,
        "total_value": total_value,
        "unrealized_pnl": sum(r["unrealized_pnl"] for r in rows),
        "positions": rows,
    }
