"""Tests for repository functions (conn=None path, autocommit)."""

import sqlite3

import pytest

from app.db import (
    add_watchlist,
    delete_position,
    get_position,
    insert_chat_message,
    insert_snapshot,
    insert_trade,
    list_chat_messages,
    list_positions,
    list_snapshots,
    list_trades,
    list_watchlist,
    remove_watchlist,
    upsert_position,
)


def test_add_watchlist_returns_booleans(db_path):
    assert add_watchlist("PYPL") is True
    assert add_watchlist("PYPL") is False
    assert add_watchlist("AAPL") is False  # already a default ticker
    assert list_watchlist()[-1] == "PYPL"


def test_remove_watchlist_returns_booleans(db_path):
    assert remove_watchlist("NFLX") is True
    assert remove_watchlist("NFLX") is False
    assert remove_watchlist("NOPE") is False
    assert "NFLX" not in list_watchlist()


def test_position_upsert_insert_then_update(db_path):
    assert get_position("AAPL") is None

    upsert_position("AAPL", 10, 190.0)
    pos = get_position("AAPL")
    assert pos is not None
    assert pos["quantity"] == 10
    assert pos["avg_cost"] == 190.0
    assert pos["updated_at"]

    upsert_position("AAPL", 15, 185.0)  # same row, updated
    assert len(list_positions()) == 1
    assert get_position("AAPL")["quantity"] == 15


def test_list_positions_ordered_by_ticker(db_path):
    upsert_position("TSLA", 1, 1.0)
    upsert_position("AAPL", 2, 2.0)
    assert [p["ticker"] for p in list_positions()] == ["AAPL", "TSLA"]


def test_delete_position(db_path):
    upsert_position("AAPL", 5, 100.0)
    delete_position("AAPL")
    assert get_position("AAPL") is None
    delete_position("AAPL")  # deleting a missing row is a no-op


def test_trades_newest_first_and_limit(db_path):
    for i in range(3):
        insert_trade("AAPL", "buy", i + 1, 100.0 + i)
    trades = list_trades()
    assert [t["quantity"] for t in trades] == [3, 2, 1]
    assert list_trades(limit=2)[0]["quantity"] == 3
    assert len(list_trades(limit=2)) == 2

    t = trades[0]
    assert set(t) == {"id", "ticker", "side", "quantity", "price", "executed_at"}


def test_trade_side_is_constrained(db_path):
    with pytest.raises(sqlite3.IntegrityError):
        insert_trade("AAPL", "short", 1, 1.0)


def test_snapshots_oldest_first(db_path):
    for v in (100.0, 110.0, 120.0):
        insert_snapshot(v)
    snaps = list_snapshots()
    assert [s["total_value"] for s in snaps] == [100.0, 110.0, 120.0]
    assert set(snaps[0]) == {"total_value", "recorded_at"}


def test_snapshots_limit_returns_newest_oldest_first(db_path):
    for v in (100.0, 110.0, 120.0):
        insert_snapshot(v)
    assert [s["total_value"] for s in list_snapshots(limit=2)] == [110.0, 120.0]


def test_chat_round_trip_with_json_actions(db_path):
    insert_chat_message("user", "buy 2 AAPL")
    actions = {
        "trades": [{"ticker": "AAPL", "side": "buy", "quantity": 2, "status": "executed"}],
        "watchlist_changes": [],
    }
    created = insert_chat_message("assistant", "Done.", actions=actions)
    assert created["actions"] == actions

    msgs = list_chat_messages()
    assert [m["role"] for m in msgs] == ["user", "assistant"]  # oldest first
    assert msgs[0]["actions"] is None
    assert msgs[1]["actions"] == actions
    assert msgs[1]["content"] == "Done."


def test_chat_limit_returns_newest_oldest_first(db_path):
    for i in range(5):
        insert_chat_message("user", f"m{i}")
    assert [m["content"] for m in list_chat_messages(limit=2)] == ["m3", "m4"]
