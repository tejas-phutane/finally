# Backend API status

## Done
- app/portfolio/service.py: execute_trade (single db.transaction, conn passed to every repo call), get_portfolio, record_snapshot, TradeError (20 tests)
- app/api/ops.py: watchlist guards (open-position check), session_open tracking, watchlist view, chat context
- app/api/routes.py: all /api endpoints from CONTRACTS.md, including /api/chat/history (24 tests)
- app/api/testing.py: POST /api/test/reset, mounted only when LLM_MOCK=true (4 tests; uses db.reset_to_seed)
- app/main.py: lifespan, 30s snapshot loop, SSE router, static mount when FINALLY_STATIC_DIR exists, .env loader
- Full suite: 170 passed; ruff check app/ tests/ clean

## Contract changes
- POST /api/test/reset (LLM_MOCK=true only): returns {"status":"reset"}. Calls db.reset_to_seed(); reseeds $10k and default watchlist; syncs market source (add/remove tickers) and clears session_open.
- portfolio_context passed to llm.client.chat_completion is now flat: {cash_balance, total_value, unrealized_pnl, positions, watchlist:[{ticker, price}]}.

## Requests
- Resolved: the reset route now calls db.reset_to_seed() (no raw SQL).
- Market owner: local .env has MASSIVE_API_KEY, and the Massive poll returned "404 page not found" in a local run.

## Notes
- Trade errors return 400 with {"detail": message}, which the frontend shows.
- Quantity <= 0 is a 400; an invalid side is a 422 from pydantic.
