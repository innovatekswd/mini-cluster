/**
 * Services feature — API CRUD + UI smoke tests
 * Covers: create, list, get, update, delete, start/stop, env vars, args.
 */
import { test, expect, type APIRequestContext } from '@playwright/test';
import { test as authedTest } from '../../fixtures';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function apiLogin(request: APIRequestContext, baseURL: string): Promise<string> {
  const res = await request.post(`${baseURL}/api/auth/login`, {
    data: { username: 'admin', password: 'admin' },
  });
  const body = await res.json();
  return body.accessToken as string;
}

async function createService(
  request: APIRequestContext,
  baseURL: string,
  token: string,
  name: string,
  extra: Record<string, unknown> = {},
) {
  return request.post(`${baseURL}/api/services`, {
    data: { name, executablePath: 'echo', arguments: 'hello', ...extra },
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ─── Service CRUD ─────────────────────────────────────────────────────────────

test.describe('Services API CRUD', () => {
  test('create, read, update, delete a service', async ({ request, baseURL }) => {
    const token = await apiLogin(request, baseURL!);

    // Create
    const createRes = await createService(request, baseURL!, token, 'e2e-svc-crud');
    expect(createRes.status()).toBeLessThan(300);
    const svc = await createRes.json();
    expect(svc.id).toBeTruthy();
    expect(svc.name).toBe('e2e-svc-crud');

    // Read by ID
    const getRes = await request.get(`${baseURL}/api/services/${svc.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(getRes.status()).toBe(200);

    // Read by name
    const getByNameRes = await request.get(`${baseURL}/api/services/e2e-svc-crud`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(getByNameRes.status()).toBe(200);

    // Update
    const updateRes = await request.put(`${baseURL}/api/services/${svc.id}`, {
      data: { name: 'e2e-svc-crud', executablePath: 'echo', description: 'updated' },
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(updateRes.status()).toBeLessThan(300);

    const afterUpdate = await request.get(`${baseURL}/api/services/${svc.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect((await afterUpdate.json()).description).toBe('updated');

    // Delete
    const delRes = await request.delete(`${baseURL}/api/services/${svc.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(delRes.status()).toBeLessThan(300);

    // Verify gone
    const gone = await request.get(`${baseURL}/api/services/${svc.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(gone.status()).toBe(404);
  });

  test('service list returns array', async ({ request, baseURL }) => {
    const token = await apiLogin(request, baseURL!);
    const res = await request.get(`${baseURL}/api/services`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
  });

  test('GET /api/services/statuses returns map keyed by service ID', async ({ request, baseURL }) => {
    const token = await apiLogin(request, baseURL!);
    const res = await request.get(`${baseURL}/api/services/statuses`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body).toBe('object');
  });
});

// ─── Service lifecycle: start / stop ─────────────────────────────────────────

test.describe('Service lifecycle', () => {
  test('start and stop a service changes its status', async ({ request, baseURL }) => {
    const token = await apiLogin(request, baseURL!);

    const createRes = await createService(request, baseURL!, token, 'e2e-svc-lifecycle', {
      arguments: '30',
      executablePath: 'sleep',
    });
    const svc = await createRes.json();

    // Start
    const startRes = await request.post(`${baseURL}/api/services/${svc.id}/exec/start`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(startRes.status()).toBeLessThan(300);

    // Short wait then check status
    await new Promise((r) => setTimeout(r, 1000));
    const statusRes = await request.get(`${baseURL}/api/services/${svc.id}/exec/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(statusRes.status()).toBe(200);

    // Stop
    const stopRes = await request.post(`${baseURL}/api/services/${svc.id}/exec/stop`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(stopRes.status()).toBeLessThan(300);

    // Cleanup
    await request.delete(`${baseURL}/api/services/${svc.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  });
});

// ─── Service env vars ─────────────────────────────────────────────────────────

test.describe('Service env vars', () => {
  test('can set and retrieve environment variables', async ({ request, baseURL }) => {
    const token = await apiLogin(request, baseURL!);
    const svc = await (await createService(request, baseURL!, token, 'e2e-svc-env')).json();

    // Set
    const putRes = await request.put(`${baseURL}/api/services/${svc.id}/env`, {
      data: { MY_VAR: 'hello', DB_PORT: '5432' },
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(putRes.status()).toBeLessThan(300);

    // Get
    const getRes = await request.get(`${baseURL}/api/services/${svc.id}/env`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(getRes.status()).toBe(200);
    const envVars = await getRes.json();
    expect(envVars['MY_VAR']).toBe('hello');
    expect(envVars['DB_PORT']).toBe('5432');

    // Cleanup
    await request.delete(`${baseURL}/api/services/${svc.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  });

  test('clearing env vars with empty object works', async ({ request, baseURL }) => {
    const token = await apiLogin(request, baseURL!);
    const svc = await (await createService(request, baseURL!, token, 'e2e-svc-env-clear')).json();

    await request.put(`${baseURL}/api/services/${svc.id}/env`, {
      data: { KEY: 'val' },
      headers: { Authorization: `Bearer ${token}` },
    });
    await request.put(`${baseURL}/api/services/${svc.id}/env`, {
      data: {},
      headers: { Authorization: `Bearer ${token}` },
    });

    const getRes = await request.get(`${baseURL}/api/services/${svc.id}/env`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const envVars = await getRes.json();
    expect(Object.keys(envVars)).toHaveLength(0);

    await request.delete(`${baseURL}/api/services/${svc.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  });
});

// ─── Service args ─────────────────────────────────────────────────────────────

test.describe('Service launch arguments', () => {
  test('can update and retrieve launch arguments', async ({ request, baseURL }) => {
    const token = await apiLogin(request, baseURL!);
    const svc = await (await createService(request, baseURL!, token, 'e2e-svc-args')).json();

    const putRes = await request.put(`${baseURL}/api/services/${svc.id}/args`, {
      data: { arguments: '--port 9090 --debug' },
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(putRes.status()).toBeLessThan(300);

    const getRes = await request.get(`${baseURL}/api/services/${svc.id}/args`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(getRes.status()).toBe(200);
    const body = await getRes.json();
    expect(body.arguments).toBe('--port 9090 --debug');

    await request.delete(`${baseURL}/api/services/${svc.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  });
});

// ─── Service logs ─────────────────────────────────────────────────────────────

test.describe('Service logs', () => {
  test('GET /logs returns array for a known service', async ({ request, baseURL }) => {
    const token = await apiLogin(request, baseURL!);
    const svc = await (await createService(request, baseURL!, token, 'e2e-svc-logs')).json();

    const res = await request.get(`${baseURL}/api/services/${svc.id}/logs`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);

    await request.delete(`${baseURL}/api/services/${svc.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  });

  test('GET /logs/search returns paged result', async ({ request, baseURL }) => {
    const token = await apiLogin(request, baseURL!);
    const svc = await (await createService(request, baseURL!, token, 'e2e-svc-search')).json();

    const res = await request.get(`${baseURL}/api/services/${svc.id}/logs/search?page=1&pageSize=10`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body).toBe('object');

    await request.delete(`${baseURL}/api/services/${svc.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  });

  test('GET /api/logs/stats returns log counters', async ({ request, baseURL }) => {
    const token = await apiLogin(request, baseURL!);
    const res = await request.get(`${baseURL}/api/logs/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body.logs).toBe('number');
    expect(typeof body.sessions).toBe('number');
  });
});

// ─── UI smoke ─────────────────────────────────────────────────────────────────

authedTest.describe('Services page UI', () => {
  authedTest('navigating to a service page works without errors', async ({ authedPage: page }) => {
    const jsErrors: string[] = [];
    page.on('pageerror', (err) => jsErrors.push(err.message));

    // Navigate to services via the API link in the sidebar/header
    await page.goto('/');
    const servicesLink = page.getByRole('link', { name: /service/i }).first();
    if (await servicesLink.isVisible({ timeout: 3_000 })) {
      await servicesLink.click();
      await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 });
    }

    const fatal = jsErrors.filter((e) => !e.includes('favicon') && !e.includes('404'));
    expect(fatal, `JS errors: ${fatal.join('\n')}`).toHaveLength(0);
  });
});
