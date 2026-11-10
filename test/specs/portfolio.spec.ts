import { test, expect, type APIRequestContext } from '@playwright/test';
import {
  heatmap,
  heatmapTile,
  openFreshApp,
  pnlChart,
  positionRow,
  submitTrade,
} from '../helpers/app';

async function snapshotCount(request: APIRequestContext): Promise<number> {
  const res = await request.get('/api/portfolio/history');
  expect(res.status()).toBe(200);
  return ((await res.json()) as unknown[]).length;
}

test.describe('Portfolio visualization', () => {
  test.beforeEach(async ({ page, request }) => {
    await openFreshApp(page, request);
  });

  test('heatmap renders a tile for each position', async ({ page }) => {
    await submitTrade(page, 'buy', 'AAPL', 5);
    await submitTrade(page, 'buy', 'TSLA', 5);

    await expect(heatmap(page)).toBeVisible();
    await expect(heatmapTile(page, 'AAPL')).toBeVisible();
    await expect(heatmapTile(page, 'TSLA')).toBeVisible();
  });

  test('heatmap tiles are colored by P&L sign', async ({ page }) => {
    await submitTrade(page, 'buy', 'NVDA', 5);
    // Frontend must expose data-pnl="gain" | "loss" | "flat" on each tile.
    await expect(heatmapTile(page, 'NVDA')).toHaveAttribute('data-pnl', /^(gain|loss|flat)$/);
  });

  test('P&L chart has data points after a trade', async ({ page, request }) => {
    const before = await snapshotCount(request);
    await submitTrade(page, 'buy', 'MSFT', 2);

    // A trade records a snapshot immediately, so history must grow.
    await expect.poll(() => snapshotCount(request)).toBeGreaterThan(before);
    await expect(pnlChart(page)).toBeVisible();
    // Frontend must expose data-point-count on the P&L chart container.
    await expect
      .poll(async () => Number(await pnlChart(page).getAttribute('data-point-count')))
      .toBeGreaterThanOrEqual(1);
  });

  test('portfolio value in header reflects the position', async ({ page }) => {
    await submitTrade(page, 'buy', 'JPM', 1);
    await expect(positionRow(page, 'JPM')).toBeVisible();
    await expect(page.getByTestId('total-value')).toBeVisible();
  });
});
