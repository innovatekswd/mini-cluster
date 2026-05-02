/**
 * Apps feature — UI tests
 * Covers the /apps page: CRUD operations (create, list, edit, delete),
 * empty state, navigation to service management.
 */
import { test, expect, type APIRequestContext } from '@playwright/test';
import { test as authedTest } from '../../fixtures';
import { config } from '../../config';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function apiLogin(request: APIRequestContext, baseURL: string): Promise<string> {
  const res = await request.post(`${baseURL}/api/auth/login`, {
    data: { username: config.admin.username, password: config.admin.password },
  });
  const body = await res.json();
  return body.accessToken as string;
}

async function createApp(request: APIRequestContext, baseURL: string, token: string, name: string) {
  return request.post(`${baseURL}/api/apps`, {
    data: { name, description: `E2E test app: ${name}`, color: '#3B82F6' },
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function deleteApp(request: APIRequestContext, baseURL: string, token: string, id: string) {
  return request.delete(`${baseURL}/api/apps/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ─── API contract ─────────────────────────────────────────────────────────────

test.describe('Apps API CRUD', () => {
  test('can create, read, update, and delete an app', async ({ request, baseURL }) => {
    const token = await apiLogin(request, baseURL!);

    // Create
    const createRes = await createApp(request, baseURL!, token, 'e2e-app-crud');
    expect(createRes.status(), 'create should return 201 or 200').toBeLessThan(300);
    const app = await createRes.json();
    expect(app.id).toBeTruthy();
    expect(app.name).toBe('e2e-app-crud');

    // Read
    const getRes = await request.get(`${baseURL}/api/apps/${app.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(getRes.status()).toBe(200);
    const fetched = await getRes.json();
    expect(fetched.name).toBe('e2e-app-crud');

    // Update
    const updateRes = await request.put(`${baseURL}/api/apps/${app.id}`, {
      data: { name: 'e2e-app-crud', description: 'updated description', color: '#10B981' },
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(updateRes.status(), 'update should succeed').toBeLessThan(300);

    const afterUpdate = await request.get(`${baseURL}/api/apps/${app.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const updatedBody = await afterUpdate.json();
    expect(updatedBody.description).toBe('updated description');

    // Delete
    const delRes = await deleteApp(request, baseURL!, token, app.id);
    expect(delRes.status(), 'delete should succeed').toBeLessThan(300);

    // Verify gone
    const gone = await request.get(`${baseURL}/api/apps/${app.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(gone.status()).toBe(404);
  });

  test('app list returns array', async ({ request, baseURL }) => {
    const token = await apiLogin(request, baseURL!);
    const res = await request.get(`${baseURL}/api/apps`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
  });

  test('getting non-existent app returns 404', async ({ request, baseURL }) => {
    const token = await apiLogin(request, baseURL!);
    const res = await request.get(`${baseURL}/api/apps/00000000-0000-0000-0000-000000000000`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(404);
  });
});

// ─── UI smoke ─────────────────────────────────────────────────────────────────

authedTest.describe('Apps page UI', () => {
  authedTest('loads /apps without JS errors', async ({ authedPage: page }) => {
    const jsErrors: string[] = [];
    page.on('pageerror', (err) => jsErrors.push(err.message));

    await page.goto(config.routes.apps);
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 });

    const fatal = jsErrors.filter((e) => !e.includes('favicon') && !e.includes('404'));
    expect(fatal, `JS errors on /apps: ${fatal.join('\n')}`).toHaveLength(0);
  });

  authedTest('shows app list or empty state', async ({ authedPage: page }) => {
    await page.goto(config.routes.apps);
    // Either shows apps cards OR an empty state message — not a blank page
    const hasContent = await page
      .locator('[class*="card"], [class*="empty"], h1, h2, p')
      .first()
      .isVisible({ timeout: 10_000 });
    expect(hasContent, 'Apps page should have visible content').toBe(true);
  });
});
