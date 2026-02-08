import { test as base, expect, type Page } from '@playwright/test';
import { config } from './config';

/**
 * Perform a real login via the UI and return the page.
 * Use this in `beforeEach` or inside a test when you need
 * an authenticated session.
 */
export async function loginViaUI(
  page: Page,
  username = config.admin.username,
  password = config.admin.password,
) {
  await page.goto(config.routes.login);
  await page.locator('#username').fill(username);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  // Wait until redirected away from /login
  await expect(page).not.toHaveURL(/\/login/);
}

/**
 * Extended test fixture that provides an already-authenticated page.
 *
 * Usage:
 *   import { test, expect } from './fixtures';
 *   test('my test', async ({ authedPage }) => { ... });
 */
export const test = base.extend<{ authedPage: Page }>({
  authedPage: async ({ page }, use) => {
    await loginViaUI(page);
    await use(page);
  },
});

export { expect };
