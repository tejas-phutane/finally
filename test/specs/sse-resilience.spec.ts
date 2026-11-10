import { test, expect } from '@playwright/test';
import { connectionDot, resetState, watchlistPrice } from '../helpers/app';

test.describe('SSE resilience', () => {
  test.beforeEach(async ({ request }) => {
    await resetState(request);
  });

  test('UI shows a non-connected state while the stream is down, then recovers', async ({ page }) => {
    // Block the price stream before the page loads so EventSource cannot connect.
    let blocking = true;
    await page.route('**/api/stream/prices', (route) => {
      if (blocking) return route.abort();
      return route.continue();
    });

    await page.goto('/');
    await expect(connectionDot(page)).not.toHaveAttribute('data-status', 'connected');

    // Restore the stream: EventSource retries automatically and should reconnect.
    blocking = false;
    await expect(connectionDot(page)).toHaveAttribute('data-status', 'connected', { timeout: 20_000 });

    // Prices resume after reconnection.
    const price = watchlistPrice(page, 'AAPL');
    const first = await price.innerText();
    await expect.poll(async () => price.innerText(), { timeout: 10_000 }).not.toBe(first);
  });

  // Unverified: Chromium's setOffline does not close an already-open EventSource, so the
  // connection status never leaves 'connected'. Re-enable once a reliable disconnect is found.
  test.fixme('prices keep updating across a forced reconnect', async ({ page }) => {
    await page.goto('/');
    await expect(connectionDot(page)).toHaveAttribute('data-status', 'connected');

    // Drop the live stream by going offline, then come back online.
    await page.context().setOffline(true);
    await expect(connectionDot(page)).not.toHaveAttribute('data-status', 'connected', { timeout: 15_000 });
    await page.context().setOffline(false);

    await expect(connectionDot(page)).toHaveAttribute('data-status', 'connected', { timeout: 20_000 });
    const price = watchlistPrice(page, 'MSFT');
    const first = await price.innerText();
    await expect.poll(async () => price.innerText(), { timeout: 10_000 }).not.toBe(first);
  });
});
