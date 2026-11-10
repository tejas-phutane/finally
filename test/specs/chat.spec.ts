import { test, expect } from '@playwright/test';
import {
  chatInput,
  chatMessages,
  chatSendButton,
  chatTradeConfirmation,
  chatWatchlistConfirmation,
  headerCash,
  openFreshApp,
  positionRow,
  readMoney,
  watchlistRow,
} from '../helpers/app';

// LLM_MOCK=true rules (planning/CONTRACTS.md, "LLM Mock Mode"):
//   "buy <qty> <TICKER>" / "sell <qty> <TICKER>" -> one trade
//   "add <TICKER>" / "watch <TICKER>" -> watchlist add; "remove <TICKER>" -> watchlist remove
//   anything else -> message echoing the input, no actions

async function sendChat(page: import('@playwright/test').Page, text: string): Promise<void> {
  await chatInput(page).fill(text);
  await chatSendButton(page).click();
}

test.describe('AI chat (mock LLM)', () => {
  test.beforeEach(async ({ page, request }) => {
    await openFreshApp(page, request);
  });

  test('chat "buy 5 AAPL" executes a trade shown inline', async ({ page }) => {
    const before = await readMoney(headerCash(page));
    await sendChat(page, 'buy 5 AAPL');

    await expect(chatTradeConfirmation(page).first()).toContainText('AAPL');
    await expect(positionRow(page, 'AAPL')).toBeVisible();
    await expect(positionRow(page, 'AAPL')).toContainText('5');
    await expect.poll(async () => readMoney(headerCash(page))).toBeLessThan(before);
  });

  test('chat "sell" of an unowned ticker shows a failed trade, no position created', async ({ page }) => {
    await sendChat(page, 'sell 5 GOOGL');

    await expect(chatMessages(page).last()).toBeVisible();
    await expect(positionRow(page, 'GOOGL')).toHaveCount(0);
  });

  test('chat "add PYPL" adds to the watchlist', async ({ page }) => {
    await sendChat(page, 'add PYPL');

    await expect(chatWatchlistConfirmation(page).first()).toContainText('PYPL');
    await expect(watchlistRow(page, 'PYPL')).toBeVisible();
  });

  test('chat "remove NFLX" removes from the watchlist', async ({ page }) => {
    await sendChat(page, 'remove NFLX');

    await expect(watchlistRow(page, 'NFLX')).toHaveCount(0);
  });

  test('non-trade message gets an echo response', async ({ page }) => {
    await sendChat(page, 'hello there');

    await expect(chatMessages(page).filter({ hasText: 'hello there' }).first()).toBeVisible();
    await expect(chatMessages(page).last()).toHaveAttribute('data-role', 'assistant');
  });

  test('chat history survives a page reload', async ({ page }) => {
    await sendChat(page, 'hello history');
    await expect(chatMessages(page).filter({ hasText: 'hello history' }).first()).toBeVisible();

    await page.reload();
    await expect(chatMessages(page).filter({ hasText: 'hello history' }).first()).toBeVisible();
  });
});
