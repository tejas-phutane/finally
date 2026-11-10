"""Fixtures for DB tests: every test gets a fresh, seeded DB file under tmp_path."""

from pathlib import Path

import pytest

from app.db import connection


@pytest.fixture
def db_path(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    path = tmp_path / "finally.db"
    monkeypatch.setenv("FINALLY_DB_PATH", str(path))
    # Reset module state so each test starts uninitialized; monkeypatch restores it after.
    monkeypatch.setattr(connection, "_active_path", None)
    connection.init_db(path)
    return path
