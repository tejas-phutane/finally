# Frontend Engineer — status

## Done
- `frontend/` scaffolded: Next.js 16 (App Router, `output: 'export'`, images unoptimized), React 19, Tailwind v4 (`@tailwindcss/postcss`), TypeScript strict, ESLint.
- Dark terminal layout: header (portfolio value, cash, connection dot), watchlist with flash prices, sparklines and day %, main chart (Lightweight Charts v5), treemap heatmap, portfolio value chart, positions table, trade bar, collapsible AI chat.
- Data layer: `hooks/usePriceStream.ts` (EventSource, status from readyState, self-reconnect when CLOSED), `usePortfolio`, `useWatchlist`, `useChat`. REST client in `lib/api.ts` (relative `/api/*` URLs).
- Live portfolio value and positions are re-priced from SSE prices (`lib/portfolio.ts`).
- Unit tests (Vitest + RTL): 27 tests across lib, flash, watchlist, chat, trade bar.

## Results
- `npm test`: 5 files, 27 tests pass.
- `npm run lint`: clean.
- `npm run build`: produces `frontend/out/index.html`.

## data-testid names (matched to integration-tester.md)
connection-status (data-status), cash-balance, total-value, watchlist-row (data-ticker), price-cell (data-flash), watchlist-remove-button, watchlist-add-input, watchlist-add-button, main-chart (data-ticker, data-point-count), trade-ticker-input, trade-quantity-input, trade-buy-button, trade-sell-button, trade-error, trade-message, positions-table, position-row (data-ticker), quantity, avg-cost, current-price, unrealized-pnl, pct-change, portfolio-heatmap, heatmap-tile (data-ticker, data-pnl), pnl-chart (data-point-count), chat-input, chat-send, chat-message (data-role), chat-loading, chat-trade (data-status), chat-watchlist-change (data-status).

## Contract changes
- None to CONTRACTS.md shapes. Uses `GET /api/chat/history` as specified.

## Open / notes
- Verified in a browser against the live backend (mock LLM): page loads, SSE prices stream, no console errors, a market buy updates cash and positions.
- Watchlist `day_change_percent` comes from REST and is refreshed every 10s; live price from SSE.
