import { test, expect } from '@playwright/test';
import {
  headerCash,
  openFreshApp,
  positionRow,
  readMoney,
  submitTrade,
  tradeError,
} from '../helpers/app';

test.describe('Trading', () => {
  test.beforeEach(async ({ page, request }) => {
    await openFreshApp(page, request);
  });

  test('buy shares: cash decreases and position appears', async ({ page }) => {
    await submitTrade(page, 'buy', 'AAPL', 5);

    await expect(positionRow(page, 'AAPL')).toBeVisible();
    await expect(positionRow(page, 'AAPL')).toContainText('5');
    await expect.poll(async () => readMoney(headerCash(page))).toBeLessThan(10_000);
  });

  test('sell part of a position: quantity drops and cash increases', async ({ page }) => {
    await submitTrade(page, 'buy', 'MSFT', 10);
    await expect(positionRow(page, 'MSFT')).toContainText('10');
    const cashAfterBuy = await readMoney(headerCash(page));

    await submitTrade(page, 'sell', 'MSFT', 4);
    await expect(positionRow(page, 'MSFT')).toContainText('6');
    await expect.poll(async () => readMoney(headerCash(page))).toBeGreaterThan(cashAfterBuy);
  });

  test('sell entire position: position disappears', async ({ page }) => {
    await submitTrade(page, 'buy', 'NVDA', 3);
    await expect(positionRow(page, 'NVDA')).toBeVisible();

    await submitTrade(page, 'sell', 'NVDA', 3);
    await expect(positionRow(page, 'NVDA')).toHaveCount(0);
  });

  test('buying more than cash allows is rejected', async ({ page }) => {
    await submitTrade(page, 'buy', 'AMZN', 1_000_000);

    await expect(tradeError(page)).toBeVisible();
    await expect(positionRow(page, 'AMZN')).toHaveCount(0);
    await expect(headerCash(page)).toContainText('10,000');
  });

  test('selling shares not owned is rejected', async ({ page }) => {
    await submitTrade(page, 'sell', 'GOOGL', 1);

    await expect(tradeError(page)).toBeVisible();
    await expect(positionRow(page, 'GOOGL')).toHaveCount(0);
    await expect(headerCash(page)).toContainText('10,000');
  });

  test('positions table shows quantity, average cost, price and P&L columns', async ({ page }) => {
    await submitTrade(page, 'buy', 'META', 2);
    const row = positionRow(page, 'META');
    await expect(row).toBeVisible();
    for (const column of ['quantity', 'avg-cost', 'current-price', 'unrealized-pnl', 'pct-change']) {
      await expect(row.getByTestId(column)).toBeVisible();
    }
  });
});
