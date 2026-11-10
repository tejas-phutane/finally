# FinAlly — Team Contracts

Shared interfaces for the agent team. `PLAN.md` is the product spec; this file pins the
exact names and shapes so independent engineers can build in parallel. If you need to
change a contract, edit this file in the same change and note it in your status file.

## Ownership

| Role | Owns |
|---|---|
| Database Engineer | `backend/app/db/`, `backend/tests/db/` |
| Backend API Engineer | `backend/app/main.py`, `backend/app/api/`, `backend/app/portfolio/`, `backend/tests/api/`, `backend/tests/portfolio/`, `backend/pyproject.toml` |
| LLM Engineer | `backend/app/llm/`, `backend/tests/llm/` |
| Frontend Engineer | `frontend/` (everything inside it) |
| DevOps Engineer | `Dockerfile`, `.dockerignore`, `docker-compose.yml`, `scripts/`, `.env.example`, `db/.gitkeep` |
| Integration Tester | `test/` |
| Existing (done) | `backend/app/market/`, `backend/tests/market/` — do not modify without asking the lead |

Each role also writes a status file at `planning/status/<role>.md` (create it; keep it short:
done / in progress / blocked / contract changes). Do not edit another role's files. If you
need something from another role, record it in your status file under "Requests".

## Environment & Runtime

- Python: run from `backend/` with `env -u PYTHONPATH uv run --extra dev ...`.
  (The shell has a ROS `PYTHONPATH` that breaks pytest; clearing it is required.)
- Test: `env -u PYTHONPATH uv run --extra dev pytest -v`; lint: `uv run --extra dev ruff check app/ tests/`.
- Config via env vars (see PLAN.md §5). Load `.env` from project root for local runs.
- `FINALLY_DB_PATH` — SQLite file. Default `<project>/db/finally.db`. Container: `/app/db/finally.db`.
- `FINALLY_STATIC_DIR` — built frontend. Default `<project>/frontend/out`. Container: `/app/static`.
- `OPENROUTER_API_KEY`, `LLM_MOCK`, `MARKET_DATA_PROVIDER` (yahoo | simulator) as in PLAN.md.
- Use the latest stable APIs as of now (FastAPI lifespan, Next.js 16, Tailwind v4, Playwright current).

## Database (`app/db/`)

Stdlib `sqlite3`, schema as in PLAN.md §7. Lazy init: first call to `get_connection()`
creates the schema and seeds (profile `default` with 10000.0 cash; 10 default watchlist rows)
if the file or tables are missing. Idempotent.

```python
# app/db/__init__.py
def init_db(path: str | None = None) -> None          # create schema + seed if needed
@contextmanager
def transaction() -> Iterator[sqlite3.Connection]      # BEGIN ... COMMIT/ROLLBACK
# Repository functions. All accept keyword `conn=None`; if given, they run inside that
# transaction and do NOT commit. If None, they run in their own committed statement.
get_cash_balance(conn=None) -> float
set_cash_balance(amount: float, conn=None) -> None
list_positions(conn=None) -> list[dict]                # {ticker, quantity, avg_cost, updated_at}
get_position(ticker, conn=None) -> dict | None
upsert_position(ticker, quantity, avg_cost, conn=None) -> None
delete_position(ticker, conn=None) -> None
insert_trade(ticker, side, quantity, price, conn=None) -> dict   # {id, ticker, side, quantity, price, executed_at}
list_trades(limit=50, conn=None) -> list[dict]        # newest first
list_watchlist(conn=None) -> list[str]                # ordered by added_at
add_watchlist(ticker, conn=None) -> bool              # False if already present
remove_watchlist(ticker, conn=None) -> bool           # False if not present
insert_snapshot(total_value, conn=None) -> dict       # {id, total_value, recorded_at}
list_snapshots(limit=None, conn=None) -> list[dict]   # oldest first: {total_value, recorded_at}
insert_chat_message(role, content, actions=None, conn=None) -> dict   # actions: JSON-serialized dict or None
list_chat_messages(limit=20, conn=None) -> list[dict] # oldest first: {id, role, content, actions (dict|None), created_at}
```

All rows use `user_id = 'default'`. Timestamps are ISO-8601 UTC strings.
Tests use a temp file path passed to `init_db`, never the real `db/finally.db`.

## Portfolio (`app/portfolio/`) — Backend API Engineer

```python
class TradeError(Exception):   # .message: str  — user-facing reason, e.g. "Insufficient cash"
def execute_trade(cache: PriceCache, ticker: str, quantity: float, side: str) -> dict
    # side in {"buy","sell"}; quantity > 0; price from cache (error if none).
    # Buy: cost <= cash. Sell: quantity <= held. Avg cost updated on buys; position
    # deleted when quantity reaches 0. Runs in db.transaction(). Records a snapshot after.
    # Returns {"id","ticker","side","quantity","price","executed_at"}.
def get_portfolio(cache: PriceCache) -> dict
    # {"cash_balance", "total_value", "unrealized_pnl",
    #  "positions": [{"ticker","quantity","avg_cost","current_price","market_value",
    #                 "unrealized_pnl","pct_change","weight"}]}
    # total_value = cash + sum(market_value); pct_change = (price-avg)/avg*100; weight = market_value/total_value
def record_snapshot(cache: PriceCache) -> dict
```

Background snapshot task: every 30s, plus after each trade (done inside `execute_trade`).

## Market data (existing, `app/market/`)

- `cache = PriceCache()`; `source = create_market_data_source(cache)`; `await source.start(tickers)`.
- Source selection: `MARKET_DATA_PROVIDER` = `yahoo` (default) | `simulator`.
- `yahoo` (`app/market/yahoo_client.py`): yfinance, no key, one batched `yf.download` call per poll (default 15s). Unofficial Yahoo endpoint; data is delayed/approximate. Not a production feed.
- `source.add_ticker(t)` / `source.remove_ticker(t)` are async. `remove_ticker` also evicts the
  price from the cache, so **do not remove a ticker from the source while the user holds a
  position in it**; the watchlist route must check positions first.
- SSE: `create_stream_router(cache)` mounted by the app. Wire format (`GET /api/stream/prices`):
  `data: {"AAPL": {"ticker","price","previous_price","timestamp","change","change_percent","direction"}, ...}`
  — one event carries ALL tracked tickers, sent whenever the cache changes (~500ms).
- Backend records a `session_open` price per ticker (first price seen by the process) for the
  watchlist's "daily change %" field.

## HTTP API (`app/api/`) — Backend API Engineer

All JSON. Errors use FastAPI's default `{"detail": "<message>"}`.

| Method | Path | Request | Response |
|---|---|---|---|
| GET | `/api/health` | — | `{"status":"ok"}` |
| GET | `/api/stream/prices` | — | SSE (above) |
| GET | `/api/portfolio` | — | portfolio shape (above) |
| POST | `/api/portfolio/trade` | `{"ticker","quantity","side"}` | 200 `{"trade": {...}, "portfolio": {...}}`; 400 `{"detail"}` on TradeError |
| GET | `/api/portfolio/history` | — | `[{"total_value","recorded_at"}]` oldest first |
| GET | `/api/watchlist` | — | `[{"ticker","price","previous_price","change_percent","direction","session_open","day_change_percent","timestamp"}]` (price may be `null` before first tick) |
| POST | `/api/watchlist` | `{"ticker"}` | 200 = watchlist array; 409 if already present; 400 if invalid ticker (uppercase letters, 1–10 chars) |
| DELETE | `/api/watchlist/{ticker}` | — | 200 = watchlist array; 404 if not present |
| POST | `/api/chat` | `{"message"}` | 200 `{"message","trades":[...],"watchlist_changes":[...]}` (see below) |
| POST | `/api/test/reset` | — | `{"status":"reset"}`; registered ONLY when `LLM_MOCK=true`. Restores seeded state (cash 10000, default watchlist, no positions/trades/snapshots/chat) |
| GET | `/api/chat/history` | — | `[{"id","role","content","actions","created_at"}]` oldest first (addition to PLAN.md so the chat panel survives reloads) |

Chat result items:
- `trades`: `{"ticker","side","quantity","status":"executed"|"failed","price"?,"error"?}`
- `watchlist_changes`: `{"ticker","action":"add"|"remove","status":"executed"|"failed","error"?}`

Static: after all `/api/*` routes, mount `FINALLY_STATIC_DIR` at `/` with `html=True`
(SPA fallback to `index.html`). If the directory is missing, the API still runs.

App startup (lifespan): `db.init_db()` → create cache → start market source with the DB
watchlist → start the snapshot task. Shutdown: cancel task, `source.stop()`.

## LLM (`app/llm/`) — LLM Engineer

```python
# app/llm/schemas.py
class TradeInstruction(BaseModel): ticker: str; side: Literal["buy","sell"]; quantity: float
class WatchlistChange(BaseModel):  ticker: str; action: Literal["add","remove"]
class LLMResponse(BaseModel):
    message: str
    trades: list[TradeInstruction] = []
    watchlist_changes: list[WatchlistChange] = []

# app/llm/client.py
async def chat_completion(user_message: str, history: list[dict], portfolio_context: dict) -> LLMResponse
```

- Real mode: LiteLLM `completion` with model `openrouter/openai/gpt-oss-120b`,
  `extra_body={"provider": {"order": ["cerebras"]}}`, `response_format=LLMResponse`,
  `reasoning_effort="low"`. Use the `cerebras-inference` skill (`.claude/skills/cerebras/SKILL.md`).
- `history`: list of `{"role","content"}` from `db.list_chat_messages`.
- `portfolio_context`: the dict built by the backend route: `get_portfolio` + watchlist with prices.
- Never raises for provider or parse failures. Returns `LLMResponse(message=<short apology/explanation>)` with no actions.
- `LLM_MOCK=true`: deterministic, no network. Mock rules (the Integration Tester relies on these):
  - `buy <qty> <TICKER>` → one buy trade; `sell <qty> <TICKER>` → one sell trade
  - `add <TICKER>` or `watch <TICKER>` → watchlist add; `remove <TICKER>` → watchlist remove
  - anything else → message echoing the input, no actions

## Frontend (`frontend/`) — Frontend Engineer

- Next.js (latest 16), TypeScript, Tailwind v4, `output: 'export'`, build to `frontend/out/`.
- Calls relative `/api/...` only. Uses `EventSource('/api/stream/prices')`.
- Charts: Lightweight Charts (current v5 API) or Recharts. Treemap for heatmap.
- Unit tests: Vitest + React Testing Library (`npm test`).
- Scripts: `npm run build`, `npm test`, `npm run lint`.
- Accent colors: yellow `#ecad0a`, blue `#209dd7`, purple `#753991`; background `#0d1117`.
- `data-testid` attributes on key elements (ticker row, price cell, positions table, trade bar, chat messages, connection dot, cash balance, total value) so E2E tests are stable.

## Docker & scripts (DevOps)

- `Dockerfile`: stage 1 `node:20-slim` builds `frontend/`; stage 2 `python:3.12-slim` installs uv,
  `uv sync --frozen --no-dev`, copies `backend/` to `/app/backend`, copies `frontend/out` to `/app/static`,
  sets `FINALLY_DB_PATH=/app/db/finally.db`, `FINALLY_STATIC_DIR=/app/static`, exposes 8000,
  CMD `uvicorn app.main:app --host 0.0.0.0 --port 8000` (from `/app/backend`).
- Run: `docker run -v finally-data:/app/db -p 8000:8000 --env-file .env finally`.
- Scripts `scripts/start_linux.sh` and `scripts/stop_linux.sh` (Linux only): idempotent,
  `--build` flag rebuilds, do not remove the volume.

## Integration tests (`test/`) — Integration Tester

- Playwright (`@playwright/test`), headless Chromium, `test/docker-compose.test.yml` with an app
  service (`LLM_MOCK=true`) and a Playwright service. Base URL `http://localhost:8000`.
- Scenarios per PLAN.md §12 "Key Scenarios".
- Failures are reported back to the lead with the exact test name, the error, and the owning role.
