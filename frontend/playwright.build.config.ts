import { defineConfig, devices } from '@playwright/test'

// The production build (docs/features/e2e-tests.md): what the Vite dev server
// behind `npm run e2e` doesn't have. It only needs the frontend image.
export default defineConfig({
  testDir: './e2e',
  testMatch: '*.build.ts',
  workers: 1,
  forbidOnly: !!process.env.CI,
  timeout: 60_000,
  reporter: 'list',
  use: {
    baseURL: process.env.BUILD_URL ?? 'http://localhost:8080',
    locale: 'en-US',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
