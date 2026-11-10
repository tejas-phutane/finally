"""FastAPI application: REST API, SSE price stream, and static frontend."""

from __future__ import annotations

import asyncio
import logging
import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager, suppress
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app import db
from app.api import ops
from app.api.routes import router as api_router
from app.api.testing import router as testing_router
from app.market import PriceCache, create_market_data_source, create_stream_router
from app.portfolio import record_snapshot

logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parents[2]
SNAPSHOT_INTERVAL_S = 30
SESSION_TRACK_INTERVAL_S = 1


def _load_dotenv(path: Path) -> None:
    """Load KEY=VALUE lines from .env into os.environ without overriding existing vars."""
    if not path.is_file():
        return
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


async def _snapshot_loop(cache: PriceCache) -> None:
    while True:
        await asyncio.sleep(SNAPSHOT_INTERVAL_S)
        try:
            record_snapshot(cache)
        except Exception:
            logger.exception("Portfolio snapshot failed")


async def _session_open_loop(cache: PriceCache, session_open: dict[str, float]) -> None:
    while True:
        ops.track_session_opens(cache, session_open)
        await asyncio.sleep(SESSION_TRACK_INTERVAL_S)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    db.init_db(os.environ.get("FINALLY_DB_PATH") or None)

    cache: PriceCache = app.state.cache
    source = create_market_data_source(cache)
    await source.start(db.list_watchlist())

    app.state.source = source
    app.state.session_open = {}

    record_snapshot(cache)  # starting point for the P&L chart
    tasks = [
        asyncio.create_task(_snapshot_loop(cache)),
        asyncio.create_task(_session_open_loop(cache, app.state.session_open)),
    ]
    try:
        yield
    finally:
        for task in tasks:
            task.cancel()
        for task in tasks:
            with suppress(asyncio.CancelledError):
                await task
        await source.stop()


def create_app() -> FastAPI:
    _load_dotenv(PROJECT_ROOT / ".env")
    app = FastAPI(title="FinAlly", lifespan=lifespan)
    app.state.cache = PriceCache()

    app.include_router(api_router)
    app.include_router(create_stream_router(app.state.cache))
    if os.environ.get("LLM_MOCK", "").strip().lower() == "true":
        app.include_router(testing_router)  # POST /api/test/reset for E2E runs

    # Mounted last so /api/* routes take precedence over static files.
    static_dir = Path(os.environ.get("FINALLY_STATIC_DIR") or PROJECT_ROOT / "frontend" / "out")
    if static_dir.is_dir():
        app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")
    else:
        logger.warning("Static dir %s not found; API only", static_dir)
    return app


app = create_app()
