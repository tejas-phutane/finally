import { test, expect } from '@playwright/test';
import {
  openFreshApp,
  watchlistAddButton,
  watchlistAddInput,
  watchlistRemoveButton,
  watchlistRow,
  watchlistRows,
  DEFAULT_TICKERS,
} from '../helpers/app';

test.describe('Watchlist', () => {
  test.beforeEach(async ({ page, request }) => {
    await openFreshApp(page, request);
  });

  test('add a ticker manually', async ({ page }) => {
    await expect(watchlistRow(page, 'PYPL')).toHaveCount(0);
    await watchlistAddInput(page).fill('PYPL');
    await watchlistAddButton(page).click();
    await expect(watchlistRow(page, 'PYPL')).toBeVisible();
    await expect(watchlistRows(page)).toHaveCount(DEFAULT_TICKERS.length + 1);
  });

  test('remove a ticker manually', async ({ page }) => {
    await expect(watchlistRow(page, 'NFLX')).toBeVisible();
    await watchlistRemoveButton(page, 'NFLX').click();
    await expect(watchlistRow(page, 'NFLX')).toHaveCount(0);
    await expect(watchlistRows(page)).toHaveCount(DEFAULT_TICKERS.length - 1);
  });

  test('clicking a ticker selects it in the main chart area', async ({ page }) => {
    await watchlistRow(page, 'TSLA').click();
    await expect(page.getByTestId('main-chart')).toHaveAttribute('data-ticker', 'TSLA');
  });
});
