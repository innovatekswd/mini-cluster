import { defineConfig, devices } from '@playwright/test';

/**
 * MiniCluster E2E Test Configuration
 *
 * Supports two backend targets:
 *   BACKEND=go    → Go API  on port 5000 (UI served by binary, or dev proxy)
 *   BACKEND=dotnet → .NET API on port 5147 (default, dev proxy on 5173)
 *
 * Run examples:
 *   npx playwright test                    # .NET backend (default)
 *   BACKEND=go npx playwright test         # Go backend (binary on :5000)
 *   BACKEND=go BASE_URL=http://127.0.0.1:5000 npx playwright test
 */

const backend  = (process.env.BACKEND  ?? 'dotnet') as 'dotnet' | 'go';
const baseURL  = process.env.BASE_URL  ?? (backend === 'go' ? 'http://127.0.0.1:5000' : 'http://localhost:5173');

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
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    extraHTTPHeaders: { Accept: 'application/json' },
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
