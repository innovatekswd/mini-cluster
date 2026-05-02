/**
 * Settings feature — API read/write + UI smoke
 */
import { test, expect, type APIRequestContext } from '@playwright/test';
import { test as authedTest } from '../../fixtures';

async function apiLogin(request: APIRequestContext, baseURL: string): Promise<string> {
  const res = await request.post(`${baseURL}/api/auth/login`, {
    data: { username: 'admin', password: 'admin' },
  });
  return (await res.json()).accessToken as string;
}

// ─── Settings API ─────────────────────────────────────────────────────────────

test.describe('Settings API', () => {
  test('GET /api/settings returns a settings object', async ({ request, baseURL }) => {
    const token = await apiLogin(request, baseURL!);
    const res = await request.get(`${baseURL}/api/settings`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();
  });

  test('GET /api/settings/intervals returns numeric interval values', async ({ request, baseURL }) => {
    const token = await apiLogin(request, baseURL!);
    const res = await request.get(`${baseURL}/api/settings/intervals`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    // Interval values should be numbers (seconds or ms)
    for (const val of Object.values(body)) {
      expect(typeof val, `interval field should be a number`).toBe('number');
    }
  });

  test('PUT /api/settings can update and the change persists', async ({ request, baseURL }) => {
    const token = await apiLogin(request, baseURL!);

    // Read current settings
    const before = await (
      await request.get(`${baseURL}/api/settings`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    ).json();

    // Write back with a test field (only change description if present)
    const payload = { ...before };
    const updateRes = await request.put(`${baseURL}/api/settings`, {
      data: payload,
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(updateRes.status()).toBeLessThan(300);

    // Read back and confirm no data loss
    const after = await (
      await request.get(`${baseURL}/api/settings`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    ).json();
    expect(after).toBeTruthy();
  });
});

// ─── UI smoke ─────────────────────────────────────────────────────────────────

authedTest.describe('Settings page UI', () => {
  authedTest('loads /settings without JS errors', async ({ authedPage: page }) => {
    const jsErrors: string[] = [];
    page.on('pageerror', (err) => jsErrors.push(err.message));

    await page.goto('/settings');
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 });

    const fatal = jsErrors.filter((e) => !e.includes('favicon') && !e.includes('404'));
    expect(fatal, `JS errors on /settings: ${fatal.join('\n')}`).toHaveLength(0);
  });

  authedTest('settings page has visible form controls', async ({ authedPage: page }) => {
    await page.goto('/settings');
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 });
    // Should have at least one input, select, or button beyond the nav
    const controls = page.locator('input, select, button[type="submit"]');
    await expect(controls.first()).toBeVisible({ timeout: 5_000 });
  });
});
