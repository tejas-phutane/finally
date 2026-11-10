# Integration Tester — status

## Done (scaffold)
- `test/package.json`, `test/tsconfig.json`, `test/playwright.config.ts` (Playwright 1.65, headless Chromium, trace/screenshot on failure, no webServer, baseURL `BASE_URL` or http://localhost:8000).
- Chromium installed (`npx playwright install chromium`); launches headless without sudo.
- `test/docker-compose.test.yml`: `app` (builds repo-root Dockerfile, `LLM_MOCK=true`, tmpfs `/app/db`, healthcheck on /api/health) and `playwright` (`mcr.microsoft.com/playwright:v1.65.0-noble`, runs `npx playwright test` against http://app:8000). Validated with `docker compose -f test/docker-compose.test.yml config`.
- Specs (25 tests): `test/specs/{fresh-start,watchlist,trading,portfolio,chat,sse-resilience}.spec.ts`. Shared helpers in `test/helpers/app.ts`.
- `npx tsc --noEmit` passes; `npx playwright test --list` discovers 25 tests.
- NOT run against the app (per lead instruction).

## Not yet verified
- Specs have never executed; selectors are a proposal (see below).
- `sse-resilience` "prices keep updating across a forced reconnect" uses `context.setOffline`; unverified that it drops an open EventSource.

## Requests (contract gaps)
1. **Backend API**: add `POST /api/test/reset` (only when `LLM_MOCK=true`) that restores seeded state: cash 10000, default 10 watchlist rows, no positions, no trades, no snapshots beyond one, no chat messages. Every spec calls it in `beforeEach`. Without it, tests cannot be independent.
2. **Frontend**: CONTRACTS.md lists data-testid areas but not exact names. The specs use these; please match them or tell me the names you chose:
   - `connection-status` with `data-status="connected|reconnecting|disconnected"`
   - `cash-balance`, `total-value` (header)
   - `watchlist-row` with `data-ticker`; inside it `price-cell`, `watchlist-remove-button`
   - `watchlist-add-input`, `watchlist-add-button`
   - `main-chart` with `data-ticker` (selected ticker)
   - `trade-ticker-input`, `trade-quantity-input`, `trade-buy-button`, `trade-sell-button`, `trade-error` (shown on rejected trade)
   - `positions-table`; `position-row` with `data-ticker`; inside it `quantity`, `avg-cost`, `current-price`, `unrealized-pnl`, `pct-change`
   - `portfolio-heatmap`; `heatmap-tile` with `data-ticker` and `data-pnl="gain|loss|flat"`
   - `pnl-chart` with `data-point-count`
   - `chat-input`, `chat-send`, `chat-message` with `data-role="user|assistant"`, `chat-loading`
   - `chat-trade` (inline trade confirmation), `chat-watchlist-change` (inline watchlist confirmation)
3. **Frontend/Backend**: rejected trades should show an error in the UI (`trade-error`) with the backend `detail` text.

## Notes
- `docker compose config` expands `env_file` values to stdout (it prints all keys from `.env`). Avoid running it in shared logs; use `docker compose ... config --quiet` to validate only.
- The root Dockerfile now exists and builds; the stack runs (see final run below).

## Final E2E run (clean stack, after Massive removal)
**24 passed, 1 skipped (test.fixme), 0 failed. Exit code 0.** Stack built with `down -v` then `up --build`; app healthy with `MARKET_DATA_PROVIDER=simulator` (pinned in test compose) and `LLM_MOCK=true`. Stack torn down afterward.
Owners: no failures. Skipped test is test-side (see below).

## E2E run (2026-11-10) — previous
Latest run (after pinning `MARKET_DATA_PROVIDER=simulator` in the test compose): **24 passed, 1 skipped (test.fixme), 0 failed**, exit 0, 14.9s. Earlier run details below.
The test compose pins `MARKET_DATA_PROVIDER=simulator` (MASSIVE_API_KEY was removed from the app and the compose) on the app; `.env` is untouched.

Full suite run in the Docker stack (`docker compose -f test/docker-compose.test.yml up` + `run --rm playwright`), LLM_MOCK=true, MASSIVE_API_KEY forced empty in the test compose.

**Result: 24 passed, 1 skipped (test.fixme), 0 failed.** One full run; not repeated.

Verified (passing against the live app):
- fresh-start: 10 default tickers, $10,000 cash and total, connection `connected`, AAPL price streams.
- watchlist: add PYPL, remove NFLX, click ticker -> main-chart `data-ticker`.
- trading: buy (cash down, position), partial sell (qty and cash up), full sell (position gone), over-cash buy rejected, sell-unowned rejected, positions columns present.
- portfolio: heatmap tiles per position, `data-pnl` present, P&L chart point count and snapshot history grows after trade, header total.
- chat (mock): "buy 5 AAPL" inline trade + position; "sell 5 GOOGL" no position; "add PYPL"; "remove NFLX"; echo for other text; history survives reload.
- sse-resilience: stream blocked at load -> status leaves `connected`, unblocked -> reconnects to `connected` and prices update. **Verified.**

Unverified / skipped:
- sse-resilience "prices keep updating across a forced reconnect" (`context.setOffline`) is `test.fixme`. Chromium's offline emulation does not close an open EventSource, so the status stayed `connected` (15s wait). This is a test-design limit, not an app defect. **Unverified.**

Earlier run (before the simulator pin):

Issues found and fixed in test/ only (not app defects):
1. `tmpfs: /app/db` was root-owned, so SQLite could not create `finally.db` for uid 1000 (`sqlite3.OperationalError: unable to open database file`, app exited). Fixed with `/app/db:uid=1000,gid=1000,mode=0755`.
2. Chromium navigation to `http://app:8000/` failed with `ERR_SSL_PROTOCOL_ERROR` in the Playwright container, while curl and Chromium via IP (172.18.0.2) worked. A dotted network alias `app.e2e.test` works. `BASE_URL` is now `http://app.e2e.test:8000`. Root cause in Chromium/single-label hostnames was not pinned down further.
3. `MASSIVE_API_KEY: ""` is forced in the test compose so the simulator is used.

App defects: none observed in the suite. The `POST /api/test/reset` endpoint works.
