import { expect, type APIRequestContext, type Locator, type Page } from '@playwright/test';

export const DEFAULT_TICKERS = [
  'AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA', 'NVDA', 'META', 'JPM', 'V', 'NFLX',
] as const;

/**
 * Reset backend state to the seeded default ($10,000 cash, default watchlist, no positions,
 * no trades, no chat history).
 *
 * Relies on a test-only endpoint `POST /api/test/reset` that the Backend API Engineer must
 * provide (enabled only when LLM_MOCK=true). Requested in planning/status/integration-tester.md.
 */
export async function resetState(request: APIRequestContext): Promise<void> {
  const res = await request.post('/api/test/reset');
  expect(res.status(), 'POST /api/test/reset must return 200').toBe(200);
}

/** Reset the backend, then load the app and wait for the first price stream event. */
export async function openFreshApp(page: Page, request: APIRequestContext): Promise<void> {
  await resetState(request);
  await page.goto('/');
  await expect(watchlistRow(page, 'AAPL')).toBeVisible();
  await expect(connectionDot(page)).toHaveAttribute('data-status', 'connected');
}

// ---- Selectors (data-testid contract; see planning/status/integration-tester.md) ----

export const connectionDot = (page: Page) => page.getByTestId('connection-status');
export const headerCash = (page: Page) => page.getByTestId('cash-balance');
export const headerTotal = (page: Page) => page.getByTestId('total-value');

export const watchlistRows = (page: Page) => page.getByTestId('watchlist-row');
export const watchlistRow = (page: Page, ticker: string) =>
  page.locator(`[data-testid="watchlist-row"][data-ticker="${ticker}"]`);
export const watchlistPrice = (page: Page, ticker: string) =>
  watchlistRow(page, ticker).getByTestId('price-cell');
export const watchlistAddInput = (page: Page) => page.getByTestId('watchlist-add-input');
export const watchlistAddButton = (page: Page) => page.getByTestId('watchlist-add-button');
export const watchlistRemoveButton = (page: Page, ticker: string) =>
  watchlistRow(page, ticker).getByTestId('watchlist-remove-button');

export const tradeTickerInput = (page: Page) => page.getByTestId('trade-ticker-input');
export const tradeQuantityInput = (page: Page) => page.getByTestId('trade-quantity-input');
export const tradeBuyButton = (page: Page) => page.getByTestId('trade-buy-button');
export const tradeSellButton = (page: Page) => page.getByTestId('trade-sell-button');
export const tradeError = (page: Page) => page.getByTestId('trade-error');

export const positionsTable = (page: Page) => page.getByTestId('positions-table');
export const positionRow = (page: Page, ticker: string) =>
  page.locator(`[data-testid="position-row"][data-ticker="${ticker}"]`);

export const heatmap = (page: Page) => page.getByTestId('portfolio-heatmap');
export const heatmapTile = (page: Page, ticker: string) =>
  page.locator(`[data-testid="heatmap-tile"][data-ticker="${ticker}"]`);
export const pnlChart = (page: Page) => page.getByTestId('pnl-chart');

export const chatInput = (page: Page) => page.getByTestId('chat-input');
export const chatSendButton = (page: Page) => page.getByTestId('chat-send');
export const chatMessages = (page: Page) => page.getByTestId('chat-message');
export const chatLoading = (page: Page) => page.getByTestId('chat-loading');
export const chatTradeConfirmation = (page: Page) => page.getByTestId('chat-trade');
export const chatWatchlistConfirmation = (page: Page) => page.getByTestId('chat-watchlist-change');

// ---- Helpers ----

/** Parse a money string such as "$10,000.00" or "-$1,234.50" into a number. */
export async function readMoney(locator: Locator): Promise<number> {
  const text = (await locator.innerText()).trim();
  const negative = text.includes('-');
  const digits = text.replace(/[^0-9.]/g, '');
  const value = Number.parseFloat(digits);
  if (Number.isNaN(value)) throw new Error(`Not a money value: "${text}"`);
  return negative ? -value : value;
}

/** Fill the trade bar and click buy or sell. */
export async function submitTrade(
  page: Page,
  side: 'buy' | 'sell',
  ticker: string,
  quantity: number,
): Promise<void> {
  await tradeTickerInput(page).fill(ticker);
  await tradeQuantityInput(page).fill(String(quantity));
  await (side === 'buy' ? tradeBuyButton(page) : tradeSellButton(page)).click();
}
