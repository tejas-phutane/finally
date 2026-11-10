# Database — status

## Done
- `backend/app/db/schema.sql`: six tables from PLAN.md §7, indexes on (user_id, time) for trades, snapshots, chat.
- `backend/app/db/connection.py`: `init_db`, `get_connection`, `transaction`, path resolution (`FINALLY_DB_PATH`), seeding.
- `backend/app/db/repository.py`: all CONTRACTS.md repository functions, `conn=None` semantics.
- `reset_to_seed(conn=None)` in `app/db/connection.py`: clears all user tables and reseeds using the same seed code as `init_db`. Exported from `app.db`.
- `backend/tests/db/`: 24 tests, all passing. `ruff check` and `ruff format --check` clean.

## Contract changes / interpretations
- `insert_chat_message(actions=...)` takes a dict (or None) and JSON-encodes it. `list_chat_messages` decodes it back to a dict.
- `insert_chat_message` returns `{id, role, content, actions, created_at}`.
- `list_trades` returns `{id, ticker, side, quantity, price, executed_at}`.
- `list_snapshots(limit)` returns the newest `limit` rows, still oldest first.
- Seeding runs only when the default profile row is missing, so removed watchlist tickers are not re-added on restart.
- `get_connection()` returns an owned connection; the caller must close it. Lazy init runs once per process.

## Notes for other roles
- Use `transaction()` plus `conn=` for any multi-step portfolio update (e.g. `execute_trade`).
- The DB is in WAL mode. Each call opens its own connection, so it is safe from the FastAPI threadpool.

## Requests
- None.
