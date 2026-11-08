import { defineConfig, devices } from '@playwright/test'

// Browser tests (docs/features/e2e-tests.md). One worker: they share one
// seeded exercise.
export default defineConfig({
  testDir: './e2e',
  testMatch: '*.e2e.ts',
  globalSetup: './e2e/globalSetup.ts',
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  timeout: 120_000,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    // E2E_BASE_URL: an already running deployment (docs/features/e2e-tests.md).
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:15173',
    ignoreHTTPSErrors: Boolean(process.env.E2E_BASE_URL),
    locale: 'en-US',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
