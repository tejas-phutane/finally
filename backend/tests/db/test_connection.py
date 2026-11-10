"""Tests for schema creation, seeding, lazy init, and transactions."""

from pathlib import Path

import pytest

from app.db import (
    DEFAULT_TICKERS,
    add_watchlist,
    get_cash_balance,
    get_connection,
    init_db,
    insert_chat_message,
    insert_snapshot,
    insert_trade,
    list_chat_messages,
    list_positions,
    list_snapshots,
    list_trades,
    list_watchlist,
    remove_watchlist,
    reset_to_seed,
    set_cash_balance,
    transaction,
    upsert_position,
)

TABLES = {
    "users_profile",
    "watchlist",
    "positions",
    "trades",
    "portfolio_snapshots",
    "chat_messages",
}


def _table_names(path: Path) -> set[str]:
    conn = get_connection()
    try:
        rows = conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'").fetchall()
    finally:
        conn.close()
    return {r["name"] for r in rows}


def test_init_creates_all_tables(db_path):
    assert TABLES <= _table_names(db_path)


def test_fresh_db_is_seeded(db_path):
    assert get_cash_balance() == 10000.0
    assert list_watchlist() == list(DEFAULT_TICKERS)
    assert len(list_watchlist()) == 10


def test_init_is_idempotent_no_duplicate_seeds(db_path):
    init_db(db_path)
    init_db(db_path)
    assert get_cash_balance() == 10000.0
    assert list_watchlist() == list(DEFAULT_TICKERS)


def test_init_does_not_reseed_after_user_removes_tickers(db_path):
    for t in DEFAULT_TICKERS:
        remove_watchlist(t)
    init_db(db_path)
    assert list_watchlist() == []


def test_init_keeps_existing_balance(db_path):
    set_cash_balance(1234.5)
    init_db(db_path)
    assert get_cash_balance() == 1234.5


def test_init_creates_parent_directory(tmp_path, monkeypatch):
    from app.db import connection

    monkeypatch.setattr(connection, "_active_path", None)
    path = tmp_path / "nested" / "dir" / "finally.db"
    init_db(path)
    assert path.exists()


def test_get_connection_lazily_initializes_from_env(tmp_path, monkeypatch):
    from app.db import connection

    path = tmp_path / "lazy.db"
    monkeypatch.setenv("FINALLY_DB_PATH", str(path))
    monkeypatch.setattr(connection, "_active_path", None)
    assert not path.exists()

    assert get_cash_balance() == 10000.0
    assert path.exists()
    assert TABLES <= _table_names(path)


def test_transaction_commits_on_success(db_path):
    with transaction() as conn:
        set_cash_balance(500.0, conn=conn)
    assert get_cash_balance() == 500.0


def test_transaction_rolls_back_on_exception(db_path):
    with pytest.raises(RuntimeError, match="boom"), transaction() as conn:
        set_cash_balance(1.0, conn=conn)
        insert_trade("AAPL", "buy", 1, 190.0, conn=conn)
        raise RuntimeError("boom")

    assert get_cash_balance() == 10000.0
    assert list_trades() == []


def test_conn_participates_in_outer_transaction(db_path):
    """Inside the transaction the write is visible to conn=conn but not to other
    connections until COMMIT."""
    with transaction() as conn:
        set_cash_balance(700.0, conn=conn)
        assert get_cash_balance(conn=conn) == 700.0
        # A separate connection (conn=None) must not see the uncommitted write.
        assert get_cash_balance() == 10000.0

    assert get_cash_balance() == 700.0


def test_reset_to_seed_clears_user_data_and_reseeds(db_path):
    set_cash_balance(1.0)
    remove_watchlist("AAPL")
    add_watchlist("PYPL")
    insert_trade("MSFT", "buy", 1, 400.0)
    upsert_position("MSFT", 1, 400.0)
    insert_snapshot(9999.0)
    insert_chat_message("user", "hi")

    reset_to_seed()

    assert get_cash_balance() == 10000.0
    assert list_watchlist() == list(DEFAULT_TICKERS)
    assert list_trades() == []
    assert list_positions() == []
    assert list_snapshots() == []
    assert list_chat_messages() == []


def test_reset_to_seed_with_conn_inside_transaction(db_path):
    set_cash_balance(1.0)
    with pytest.raises(RuntimeError, match="stop"), transaction() as conn:
        reset_to_seed(conn=conn)
        assert get_cash_balance(conn=conn) == 10000.0
        raise RuntimeError("stop")
    assert get_cash_balance() == 1.0  # rolled back with the outer transaction


def test_repo_call_with_conn_does_not_commit(db_path):
    """Repository calls given conn= leave the commit to the caller."""
    with pytest.raises(RuntimeError, match="stop"), transaction() as conn:
        insert_trade("MSFT", "buy", 2, 400.0, conn=conn)
        raise RuntimeError("stop")
    assert list_trades() == []
