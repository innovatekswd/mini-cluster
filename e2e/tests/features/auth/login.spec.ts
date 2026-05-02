import { test, expect } from '../../fixtures';
import { config } from '../../config';
import { loginViaUI } from '../../fixtures';

test.describe('Login', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(config.routes.login);
  });

  // ─── Page renders ────────────────────────────────────────
  test('shows login form with username and password fields', async ({ page }) => {
    await expect(page.locator('#username')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  });

  // ─── Validation ──────────────────────────────────────────
  test('shows error when submitting empty form', async ({ page }) => {
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('[class*="rose"]')).toBeVisible();
  });

  test('shows error for invalid credentials', async ({ page }) => {
    await page.locator('#username').fill('wrong');
    await page.locator('#password').fill('wrong');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('[class*="rose"]')).toBeVisible();
  });

  // ─── Successful login ───────────────────────────────────
  test('redirects to home after valid login', async ({ page }) => {
    await loginViaUI(page);
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('stores auth tokens in localStorage', async ({ page }) => {
    await loginViaUI(page);
    const token = await page.evaluate(
      (key) => localStorage.getItem(key),
      config.storageKeys.accessToken,
    );
    expect(token).toBeTruthy();
  });

  // ─── Auth redirect ──────────────────────────────────────
  test('redirects unauthenticated users to login', async ({ page }) => {
    await page.goto(config.routes.dashboard);
    await expect(page).toHaveURL(/\/login/);
  });

  test('redirects authenticated users away from login page', async ({ page }) => {
    await loginViaUI(page);
    await page.goto(config.routes.login);
    await expect(page).not.toHaveURL(/\/login/);
  });

  // ─── Password visibility toggle ─────────────────────────
  test('toggles password visibility', async ({ page }) => {
    await page.locator('#password').fill('secret');
    await expect(page.locator('#password')).toHaveAttribute('type', 'password');

    const toggle = page.locator('#password ~ button, button:near(#password)').first();
    if (await toggle.isVisible()) {
      await toggle.click();
      await expect(page.locator('#password')).toHaveAttribute('type', 'text');
    }
  });
});
