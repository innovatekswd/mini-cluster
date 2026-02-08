import { test, expect } from './fixtures';

test.describe('Dashboard (Home)', () => {
  // All tests use the `authedPage` fixture → already logged in.

  // ─── Page renders ────────────────────────────────────────
  test('shows Dashboard heading', async ({ authedPage: page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('displays system quick-stat cards', async ({ authedPage: page }) => {
    await page.goto('/');

    // The home page shows 6 stat cards: CPU, Memory, Disk, Network, Apps, Processes
    for (const label of ['CPU', 'Memory', 'Disk', 'Network', 'Apps', 'Processes']) {
      await expect(page.getByText(label).first()).toBeVisible();
    }
  });

  test('shows system uptime', async ({ authedPage: page }) => {
    await page.goto('/');
    await expect(page.getByText('System Uptime')).toBeVisible();
  });

  // ─── Navigation ──────────────────────────────────────────
  test('header navigation links are visible', async ({ authedPage: page }) => {
    await page.goto('/');

    // Key nav items rendered in the Layout header
    for (const name of ['Dashboard', 'Applications', 'Settings']) {
      await expect(page.getByRole('link', { name }).first()).toBeVisible();
    }
  });

  test('navigating to Apps page works', async ({ authedPage: page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Applications' }).first().click();
    await expect(page).toHaveURL('/apps');
  });

  // ─── Data loading ────────────────────────────────────────
  test('dashboard loads without errors', async ({ authedPage: page }) => {
    // Listen for console errors during page load
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/');
    // Wait for the dashboard to finish loading (spinner disappears)
    await expect(page.getByText('Loading dashboard...')).not.toBeVisible({ timeout: 15_000 });

    // No JS console errors
    expect(errors).toHaveLength(0);
  });

  // ─── Charts ──────────────────────────────────────────────
  test('renders CPU & Memory chart section', async ({ authedPage: page }) => {
    await page.goto('/');
    await expect(page.getByText('CPU & Memory Usage')).toBeVisible({ timeout: 10_000 });
  });

  test('renders Network Throughput chart section', async ({ authedPage: page }) => {
    await page.goto('/');
    await expect(page.getByText('Network Throughput')).toBeVisible({ timeout: 10_000 });
  });

  // ─── Logout ──────────────────────────────────────────────
  test('logout redirects to login page', async ({ authedPage: page }) => {
    await page.goto('/');

    // The logout button/link in the nav
    const logout = page.getByRole('link', { name: 'Logout' }).or(
      page.getByRole('button', { name: 'Logout' }),
    );

    if (await logout.isVisible()) {
      await logout.click();
      await expect(page).toHaveURL(/\/login/);
    }
  });
});
