/**
 * Environments feature — API CRUD + activation tests
 * Guards against the /api/envs 404 regression and env switching.
 */
import { test, expect, type APIRequestContext } from '@playwright/test';
import { test as authedTest } from '../../fixtures';

async function apiLogin(request: APIRequestContext, baseURL: string): Promise<string> {
  const res = await request.post(`${baseURL}/api/auth/login`, {
    data: { username: 'admin', password: 'admin' },
  });
  return (await res.json()).accessToken as string;
}

// ─── Environments CRUD ────────────────────────────────────────────────────────

test.describe('Environments API CRUD', () => {
  test('create, read, update, delete an environment', async ({ request, baseURL }) => {
    const token = await apiLogin(request, baseURL!);

    // Create
    const createRes = await request.post(`${baseURL}/api/envs`, {
      data: { name: 'e2e-env-crud', description: 'E2E test env' },
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(createRes.status()).toBeLessThan(300);
    const env = await createRes.json();
    expect(env.id).toBeTruthy();
    expect(env.name).toBe('e2e-env-crud');

    // Read
    const getRes = await request.get(`${baseURL}/api/envs/${env.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(getRes.status()).toBe(200);

    // Update
    const updateRes = await request.put(`${baseURL}/api/envs/${env.id}`, {
      data: { name: 'e2e-env-crud', description: 'updated description' },
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(updateRes.status()).toBeLessThan(300);

    const afterUpdate = await request.get(`${baseURL}/api/envs/${env.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect((await afterUpdate.json()).description).toBe('updated description');

    // Delete
    const delRes = await request.delete(`${baseURL}/api/envs/${env.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(delRes.status()).toBeLessThan(300);
  });

  test('GET /api/envs returns array', async ({ request, baseURL }) => {
    const token = await apiLogin(request, baseURL!);
    const res = await request.get(`${baseURL}/api/envs`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status(), '/api/envs must not 404 (regression: was /api/environments in Go)').toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
  });

  test('GET /api/envs/active returns current environment', async ({ request, baseURL }) => {
    const token = await apiLogin(request, baseURL!);

    // Ensure at least one env exists
    await request.post(`${baseURL}/api/envs`, {
      data: { name: 'e2e-env-active-guard', description: 'guard env' },
      headers: { Authorization: `Bearer ${token}` },
    });

    const res = await request.get(`${baseURL}/api/envs/active`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status(), '/api/envs/active must not 404').toBe(200);
    const body = await res.json();
    expect(body.id).toBeTruthy();
  });

  test('POST /api/envs/{id}/activate switches active environment', async ({ request, baseURL }) => {
    const token = await apiLogin(request, baseURL!);

    const env1Res = await request.post(`${baseURL}/api/envs`, {
      data: { name: 'e2e-env-switch-a', description: 'switch test A' },
      headers: { Authorization: `Bearer ${token}` },
    });
    const env1 = await env1Res.json();

    const activateRes = await request.post(`${baseURL}/api/envs/${env1.id}/activate`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(activateRes.status()).toBeLessThan(300);

    const activeRes = await request.get(`${baseURL}/api/envs/active`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect((await activeRes.json()).id).toBe(env1.id);

    // Cleanup
    await request.delete(`${baseURL}/api/envs/${env1.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  });
});

// ─── UI smoke ─────────────────────────────────────────────────────────────────

authedTest.describe('Settings / Environments UI', () => {
  authedTest('environments settings loads without 404 errors', async ({ authedPage: page }) => {
    const notFounds: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && msg.text().includes('404')) notFounds.push(msg.text());
    });

    await page.goto('/settings');
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(1_000);

    const envErrors = notFounds.filter((t) => t.includes('/api/envs'));
    expect(envErrors, `Unexpected /api/envs 404s: ${envErrors.join('\n')}`).toHaveLength(0);
  });
});
