import { test, expect } from '@playwright/test';
import {
  DEFAULT_TICKERS,
  connectionDot,
  headerCash,
  headerTotal,
  openFreshApp,
  watchlistPrice,
  watchlistRows,
} from '../helpers/app';

test.describe('Fresh start', () => {
  test.beforeEach(async ({ page, request }) => {
    await openFreshApp(page, request);
  });

  test('default watchlist shows the 10 seeded tickers', async ({ page }) => {
    await expect(watchlistRows(page)).toHaveCount(DEFAULT_TICKERS.length);
    for (const ticker of DEFAULT_TICKERS) {
      await expect(page.locator(`[data-testid="watchlist-row"][data-ticker="${ticker}"]`)).toBeVisible();
    }
  });

  test('shows $10,000 virtual cash and total value', async ({ page }) => {
    await expect(headerCash(page)).toContainText('10,000');
    await expect(headerTotal(page)).toContainText('10,000');
  });

  test('connection indicator is connected', async ({ page }) => {
    await expect(connectionDot(page)).toHaveAttribute('data-status', 'connected');
  });

  test('prices are streaming (AAPL price changes over time)', async ({ page }) => {
    const price = watchlistPrice(page, 'AAPL');
    const first = await price.innerText();
    await expect
      .poll(async () => price.innerText(), { timeout: 10_000, intervals: [500] })
      .not.toBe(first);
  });
});
