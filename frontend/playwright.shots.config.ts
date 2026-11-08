import { defineConfig, devices } from '@playwright/test'

// The documentation site's screenshots, on the browser tests' stack, with the
// demo exercise in English.
process.env.SEED_DEMO_LOCALE = 'en'

export default defineConfig({
  testDir: './e2e',
  testMatch: '*.shots.ts',
  globalSetup: './e2e/globalSetup.ts',
  workers: 1,
  timeout: 120_000,
  reporter: 'list',
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:15173',
        locale: 'en-US',
        // Shown about 720 px wide on the site: small enough to read, sharp at 2x.
        viewport: { width: 1280, height: 800 },
        deviceScaleFactor: 2,
      },
    },
  ],
})
