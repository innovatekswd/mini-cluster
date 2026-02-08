import { defineConfig, devices } from '@playwright/test';

/**
 * MiniCluster E2E Test Configuration
 *
 * Run against a locally running dev stack:
 *   Backend:  dotnet run (port 5147)
 *   Frontend: npm run dev  (port 5173, proxies /api → 5147)
 *
 * Playwright hits the frontend origin; the Vite proxy forwards API calls.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 30_000,

  reporter: process.env.CI
    ? [['html', { open: 'never' }], ['list']]
    : [['html', { open: 'on-failure' }]],

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Uncomment to auto-start servers before tests:
  webServer: [
    {
      command: 'dotnet run --project ../api/Innovatek.Parallel.MiniCluster.Api',
      port: 5147,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: 'npm run dev --prefix ../ui',
      port: 5173,
      reuseExistingServer: !process.env.CI,
      timeout: 15_000,
    },
  ],
  */
});
