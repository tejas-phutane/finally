import { defineConfig, devices } from '@playwright/test';

// The app runs in Docker (see docker-compose.test.yml), so no webServer is started here.
// Inside the compose network the app is reachable at http://app:8000; the default below
// is for running against a locally published port.
const baseURL = process.env.BASE_URL ?? 'http://localhost:8000';

export default defineConfig({
  testDir: './specs',
  // Tests share one backend, so run serially and keep state resets explicit.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  use: {
    baseURL,
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1600, height: 1000 } },
    },
  ],
  // webServer intentionally omitted: the app container is started by docker-compose.test.yml.
});
