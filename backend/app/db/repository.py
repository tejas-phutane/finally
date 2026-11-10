"""Repository functions for the FinAlly tables.

Every function takes keyword `conn=None`:
- conn given: runs on that connection (e.g. inside `transaction()`) and never commits.
- conn None: opens its own connection and runs in autocommit (one statement = one commit).
"""

from __future__ import annotations

import json
import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any

from app.db.connection import (
    DEFAULT_USER_ID,
    _active_db_path,
    _open,
    new_id,
    utc_now,
)


@contextmanager
def _use(conn: sqlite3.Connection | None) -> Iterator[sqlite3.Connection]:
    if conn is not None:
        yield conn
        return
    own = _open(_active_db_path())
    try:
        yield own
    finally:
        own.close()


def _rows(rows: list[sqlite3.Row]) -> list[dict[str, Any]]:
    return [dict(r) for r in rows]


# --- Cash ------------------------------------------------------------------


def get_cash_balance(conn: sqlite3.Connection | None = None) -> float:
    with _use(conn) as c:
        row = c.execute(
            "SELECT cash_balance FROM users_profile WHERE id = ?", (DEFAULT_USER_ID,)
        ).fetchone()
    if row is None:
        raise RuntimeError("users_profile row missing; call init_db()")
    return float(row["cash_balance"])


def set_cash_balance(amount: float, conn: sqlite3.Connection | None = None) -> None:
    with _use(conn) as c:
        c.execute(
            "UPDATE users_profile SET cash_balance = ? WHERE id = ?",
            (amount, DEFAULT_USER_ID),
        )


# --- Positions -------------------------------------------------------------

_POSITION_COLS = "ticker, quantity, avg_cost, updated_at"


def list_positions(conn: sqlite3.Connection | None = None) -> list[dict[str, Any]]:
    with _use(conn) as c:
        rows = c.execute(
            f"SELECT {_POSITION_COLS} FROM positions WHERE user_id = ? ORDER BY ticker",
            (DEFAULT_USER_ID,),
        ).fetchall()
    return _rows(rows)


def get_position(ticker: str, conn: sqlite3.Connection | None = None) -> dict[str, Any] | None:
    with _use(conn) as c:
        row = c.execute(
            f"SELECT {_POSITION_COLS} FROM positions WHERE user_id = ? AND ticker = ?",
            (DEFAULT_USER_ID, ticker),
        ).fetchone()
    return dict(row) if row is not None else None


def upsert_position(
    ticker: str,
    quantity: float,
    avg_cost: float,
    conn: sqlite3.Connection | None = None,
) -> None:
    with _use(conn) as c:
        c.execute(
            """
            INSERT INTO positions (id, user_id, ticker, quantity, avg_cost, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT (user_id, ticker) DO UPDATE SET
                quantity = excluded.quantity,
                avg_cost = excluded.avg_cost,
                updated_at = excluded.updated_at
            """,
            (new_id(), DEFAULT_USER_ID, ticker, quantity, avg_cost, utc_now()),
        )


def delete_position(ticker: str, conn: sqlite3.Connection | None = None) -> None:
    with _use(conn) as c:
        c.execute(
            "DELETE FROM positions WHERE user_id = ? AND ticker = ?",
            (DEFAULT_USER_ID, ticker),
        )


# --- Trades ----------------------------------------------------------------


def insert_trade(
    ticker: str,
    side: str,
    quantity: float,
    price: float,
    conn: sqlite3.Connection | None = None,
) -> dict[str, Any]:
    trade = {
        "id": new_id(),
        "ticker": ticker,
        "side": side,
        "quantity": quantity,
        "price": price,
        "executed_at": utc_now(),
    }
    with _use(conn) as c:
        c.execute(
            """
            INSERT INTO trades (id, user_id, ticker, side, quantity, price, executed_at)
            VALUES (:id, :user_id, :ticker, :side, :quantity, :price, :executed_at)
            """,
            {**trade, "user_id": DEFAULT_USER_ID},
        )
    return trade


def list_trades(limit: int = 50, conn: sqlite3.Connection | None = None) -> list[dict[str, Any]]:
    """Newest first."""
    with _use(conn) as c:
        rows = c.execute(
            """
            SELECT id, ticker, side, quantity, price, executed_at
            FROM trades WHERE user_id = ?
            ORDER BY executed_at DESC, rowid DESC
            LIMIT ?
            """,
            (DEFAULT_USER_ID, limit),
        ).fetchall()
    return _rows(rows)


# --- Watchlist -------------------------------------------------------------


def list_watchlist(conn: sqlite3.Connection | None = None) -> list[str]:
    """Tickers in the order they were added."""
    with _use(conn) as c:
        rows = c.execute(
            "SELECT ticker FROM watchlist WHERE user_id = ? ORDER BY added_at, rowid",
            (DEFAULT_USER_ID,),
        ).fetchall()
    return [r["ticker"] for r in rows]


def add_watchlist(ticker: str, conn: sqlite3.Connection | None = None) -> bool:
    """True if added, False if already present."""
    with _use(conn) as c:
        cur = c.execute(
            """
            INSERT INTO watchlist (id, user_id, ticker, added_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT (user_id, ticker) DO NOTHING
            """,
            (new_id(), DEFAULT_USER_ID, ticker, utc_now()),
        )
        return cur.rowcount == 1


def remove_watchlist(ticker: str, conn: sqlite3.Connection | None = None) -> bool:
    """True if removed, False if not present."""
    with _use(conn) as c:
        cur = c.execute(
            "DELETE FROM watchlist WHERE user_id = ? AND ticker = ?",
            (DEFAULT_USER_ID, ticker),
        )
        return cur.rowcount == 1


# --- Portfolio snapshots ---------------------------------------------------


def insert_snapshot(total_value: float, conn: sqlite3.Connection | None = None) -> dict[str, Any]:
    snap = {"id": new_id(), "total_value": total_value, "recorded_at": utc_now()}
    with _use(conn) as c:
        c.execute(
            """
            INSERT INTO portfolio_snapshots (id, user_id, total_value, recorded_at)
            VALUES (:id, :user_id, :total_value, :recorded_at)
            """,
            {**snap, "user_id": DEFAULT_USER_ID},
        )
    return snap


def list_snapshots(
    limit: int | None = None, conn: sqlite3.Connection | None = None
) -> list[dict[str, Any]]:
    """Oldest first. With `limit`, returns the newest `limit` rows, still oldest first."""
    sql_limit = -1 if limit is None else limit  # SQLite: LIMIT -1 means no limit
    with _use(conn) as c:
        rows = c.execute(
            """
            SELECT total_value, recorded_at FROM portfolio_snapshots
            WHERE user_id = ?
            ORDER BY recorded_at DESC, rowid DESC
            LIMIT ?
            """,
            (DEFAULT_USER_ID, sql_limit),
        ).fetchall()
    return list(reversed(_rows(rows)))


# --- Chat messages ---------------------------------------------------------


def insert_chat_message(
    role: str,
    content: str,
    actions: dict[str, Any] | None = None,
    conn: sqlite3.Connection | None = None,
) -> dict[str, Any]:
    """`actions` is a dict (stored as JSON) or None."""
    msg = {
        "id": new_id(),
        "role": role,
        "content": content,
        "actions": actions,
        "created_at": utc_now(),
    }
    actions_json = json.dumps(actions) if actions is not None else None
    with _use(conn) as c:
        c.execute(
            """
            INSERT INTO chat_messages (id, user_id, role, content, actions, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (msg["id"], DEFAULT_USER_ID, role, content, actions_json, msg["created_at"]),
        )
    return msg


def list_chat_messages(
    limit: int = 20, conn: sqlite3.Connection | None = None
) -> list[dict[str, Any]]:
    """Newest `limit` messages, returned oldest first. `actions` is a dict or None."""
    with _use(conn) as c:
        rows = c.execute(
            """
            SELECT id, role, content, actions, created_at FROM chat_messages
            WHERE user_id = ?
            ORDER BY created_at DESC, rowid DESC
            LIMIT ?
            """,
            (DEFAULT_USER_ID, limit),
        ).fetchall()
    out = []
    for r in reversed(rows):
        d = dict(r)
        d["actions"] = json.loads(d["actions"]) if d["actions"] is not None else None
        out.append(d)
    return out
