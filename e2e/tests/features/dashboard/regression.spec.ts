/**
 * Dashboard Crash Regression Tests
 *
 * Verifies that the dashboard renders without JavaScript errors — guards against:
 *   - systemMetrics.cpuUsagePercent.toFixed(1) when Go returned `cpuPercent`
 *   - systemMetrics.disks[0].usagePercent when `disks` was undefined
 *   - /api/envs/active 404 on Go (was mounted at /api/environments)
 *   - /api/apps 404 on Go (case-sensitive mount vs /api/Apps in UI)
 */
import { test, expect } from '../../fixtures';

test.describe('Dashboard crash regression', () => {
  test('dashboard loads without JS errors', async ({ authedPage: page }) => {
    const jsErrors: string[] = [];
    page.on('pageerror', (err) => jsErrors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') jsErrors.push(msg.text());
    });

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15_000 });

    const fatal = jsErrors.filter(
      (e) => !e.includes('favicon') && !e.includes('404') && !e.toLowerCase().includes('warning'),
    );
    expect(fatal, `Unexpected JS errors: ${fatal.join('\n')}`).toHaveLength(0);
  });

  test('system metrics bar renders without crashing', async ({ authedPage: page }) => {
    const jsErrors: string[] = [];
    page.on('pageerror', (err) => jsErrors.push(err.message));

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(2_000);

    const typeCrashes = jsErrors.filter(
      (e) => e.includes('Cannot read properties of undefined') || e.includes('toFixed'),
    );
    expect(typeCrashes, `Metrics crash: ${typeCrashes.join('\n')}`).toHaveLength(0);
  });

  test('/api/envs/active does not produce 404 in the browser console', async ({ authedPage: page }) => {
    const notFounds: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && msg.text().includes('404')) notFounds.push(msg.text());
    });

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(1_500);

    const envErrors = notFounds.filter((t) => t.includes('/api/envs'));
    expect(envErrors, `Unexpected /api/envs 404s: ${envErrors.join('\n')}`).toHaveLength(0);
  });

  test('/api/apps does not produce 404 in the browser console', async ({ authedPage: page }) => {
    const notFounds: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && msg.text().includes('404')) notFounds.push(msg.text());
    });

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(1_500);

    const appsErrors = notFounds.filter((t) => t.includes('/api/Apps') || t.includes('/api/apps'));
    expect(appsErrors, `Unexpected /api/apps 404s: ${appsErrors.join('\n')}`).toHaveLength(0);
  });
});
