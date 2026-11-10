"""SQLite connection handling, schema creation, and seeding.

Every call opens its own short-lived connection, so FastAPI threadpool use is safe.
Connections run in autocommit mode; `transaction()` issues explicit BEGIN IMMEDIATE /
COMMIT / ROLLBACK when a multi-statement unit of work needs atomicity.
"""

from __future__ import annotations

import os
import sqlite3
import threading
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

DEFAULT_USER_ID = "default"
DEFAULT_CASH_BALANCE = 10000.0
DEFAULT_TICKERS = (
    "AAPL",
    "GOOGL",
    "MSFT",
    "AMZN",
    "TSLA",
    "NVDA",
    "META",
    "JPM",
    "V",
    "NFLX",
)

_SCHEMA_PATH = Path(__file__).with_name("schema.sql")
# backend/app/db/connection.py -> parents[3] is the project root
_DEFAULT_DB_PATH = Path(__file__).resolve().parents[3] / "db" / "finally.db"

# RLock: init_db() is called from _active_db_path() while the lock is held.
_state_lock = threading.RLock()
_active_path: Path | None = None  # set by init_db(); None until first use


def utc_now() -> str:
    """Current time as an ISO-8601 UTC string."""
    return datetime.now(UTC).isoformat()


def new_id() -> str:
    """New UUID4 string primary key."""
    return str(uuid4())


def resolve_db_path(path: str | os.PathLike[str] | None = None) -> Path:
    """Explicit path, else FINALLY_DB_PATH, else <project>/db/finally.db."""
    if path is None:
        path = os.environ.get("FINALLY_DB_PATH") or _DEFAULT_DB_PATH
    return Path(path).expanduser().resolve()


def _open(path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(path, timeout=5.0, isolation_level=None)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


@contextmanager
def _tx(conn: sqlite3.Connection) -> Iterator[sqlite3.Connection]:
    """BEGIN IMMEDIATE so read-then-write units of work take the write lock up front."""
    conn.execute("BEGIN IMMEDIATE")
    try:
        yield conn
    except BaseException:
        if conn.in_transaction:
            conn.execute("ROLLBACK")
        raise
    else:
        conn.execute("COMMIT")


def _seed(conn: sqlite3.Connection) -> None:
    now = utc_now()
    conn.execute(
        "INSERT OR IGNORE INTO users_profile (id, cash_balance, created_at) VALUES (?, ?, ?)",
        (DEFAULT_USER_ID, DEFAULT_CASH_BALANCE, now),
    )
    conn.executemany(
        "INSERT INTO watchlist (id, user_id, ticker, added_at) VALUES (?, ?, ?, ?)",
        [(new_id(), DEFAULT_USER_ID, t, now) for t in DEFAULT_TICKERS],
    )


_USER_TABLES = ("positions", "trades", "portfolio_snapshots", "chat_messages", "watchlist")


def _clear_and_seed(conn: sqlite3.Connection) -> None:
    for table in _USER_TABLES:
        conn.execute(f"DELETE FROM {table}")
    conn.execute("DELETE FROM users_profile")
    _seed(conn)


def reset_to_seed(conn: sqlite3.Connection | None = None) -> None:
    """Clear all user tables and reseed the defaults ($10k cash, 10 watchlist tickers).

    With conn=None this runs atomically in its own transaction. With conn given, it
    runs on that connection and does not commit.
    """
    if conn is not None:
        _clear_and_seed(conn)
        return
    with transaction() as c:
        _clear_and_seed(c)


def init_db(path: str | os.PathLike[str] | None = None) -> None:
    """Create the schema and seed defaults if needed. Idempotent.

    Seeding happens only when the default profile row is missing, so tickers the user
    removed are never re-added on a later startup.
    """
    global _active_path
    db_path = resolve_db_path(path)
    with _state_lock:
        db_path.parent.mkdir(parents=True, exist_ok=True)
        conn = _open(db_path)
        try:
            conn.execute("PRAGMA journal_mode = WAL")
            conn.executescript(_SCHEMA_PATH.read_text(encoding="utf-8"))
            with _tx(conn):
                exists = conn.execute(
                    "SELECT 1 FROM users_profile WHERE id = ?", (DEFAULT_USER_ID,)
                ).fetchone()
                if exists is None:
                    _seed(conn)
        finally:
            conn.close()
        _active_path = db_path


def _active_db_path() -> Path:
    with _state_lock:
        if _active_path is None:
            init_db()
        assert _active_path is not None
        return _active_path


def get_connection() -> sqlite3.Connection:
    """Open a connection to the active DB, lazily initializing it on first use.

    The caller owns the returned connection and must close it.
    """
    return _open(_active_db_path())


@contextmanager
def transaction() -> Iterator[sqlite3.Connection]:
    """Atomic unit of work: COMMIT on success, ROLLBACK on any exception."""
    conn = _open(_active_db_path())
    try:
        with _tx(conn):
            yield conn
    finally:
        conn.close()
