/**
 * API Smoke Tests — work against BOTH Go (port 5000) and .NET (port 5147) backends.
 *
 * These tests hit the API directly via Playwright's `request` context so they
 * exercise the actual HTTP layer without a browser.  They act as regression
 * guards for the route mismatches that were previously breaking the UI:
 *   - /api/envs/active    (Go used /api/environments; UI called /api/envs)
 *   - /api/apps           (Go was case-sensitive; UI called /api/Apps)
 *   - /api/metrics/system (Go returned wrong field names)
 *
 * Run:
 *   npx playwright test api/                           # .NET default
 *   BACKEND=go npx playwright test api/                # Go binary
 */
import { test, expect, type APIRequestContext } from '@playwright/test';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function login(request: APIRequestContext, baseURL: string) {
  const res = await request.post(`${baseURL}/api/auth/login`, {
    data: { username: 'admin', password: 'admin' },
  });
  expect(res.status(), 'login should succeed').toBe(200);
  const body = await res.json();
  expect(body.success, 'success flag should be true').toBe(true);
  expect(body.accessToken, 'access token must be present').toBeTruthy();
  return body.accessToken as string;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

test.describe('Auth API', () => {
  test('POST /api/auth/login returns 200 with token for admin/admin', async ({ request, baseURL }) => {
    await login(request, baseURL!);
  });

  test('POST /api/auth/login returns 401 for bad credentials', async ({ request, baseURL }) => {
    const res = await request.post(`${baseURL}/api/auth/login`, {
      data: { username: 'admin', password: 'wrong' },
    });
    if (res.status() === 200) {
      expect((await res.json()).success).toBe(false);
    } else {
      expect(res.status()).toBe(401);
    }
  });

  test('GET /api/auth/me returns current user when authenticated', async ({ request, baseURL }) => {
    const token = await login(request, baseURL!);
    const res = await request.get(`${baseURL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    expect((await res.json()).username).toBe('admin');
  });
});

// ─── Health ───────────────────────────────────────────────────────────────────

test.describe('Health endpoint', () => {
  test('GET /health returns status:healthy', async ({ request, baseURL }) => {
    const res = await request.get(`${baseURL}/health`);
    expect(res.status()).toBe(200);
    expect((await res.json()).status).toBe('healthy');
  });

  test('GET /api/health also returns status:healthy', async ({ request, baseURL }) => {
    const res = await request.get(`${baseURL}/api/health`);
    expect(res.status()).toBe(200);
    expect((await res.json()).status).toBe('healthy');
  });
});

// ─── Apps route regression ────────────────────────────────────────────────────

test.describe('Apps API — route regression', () => {
  test('GET /api/apps returns array (lowercase)', async ({ request, baseURL }) => {
    const token = await login(request, baseURL!);
    const res = await request.get(`${baseURL}/api/apps`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status(), '/api/apps must not 404').toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
  });

  test('GET /api/Apps returns array (PascalCase — .NET convention)', async ({ request, baseURL }) => {
    const token = await login(request, baseURL!);
    const res = await request.get(`${baseURL}/api/Apps`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status(), '/api/Apps must not 404 (Go aliases /Apps → /apps)').toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
  });
});

// ─── Environments route regression ───────────────────────────────────────────

test.describe('Environments API — route regression', () => {
  test('GET /api/envs returns array', async ({ request, baseURL }) => {
    const token = await login(request, baseURL!);
    const res = await request.get(`${baseURL}/api/envs`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status(), '/api/envs must not 404').toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
  });

  test('GET /api/envs/active returns 200', async ({ request, baseURL }) => {
    const token = await login(request, baseURL!);
    const res = await request.get(`${baseURL}/api/envs/active`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status(), '/api/envs/active must not 404').toBe(200);
  });
});

// ─── Metrics field regression ─────────────────────────────────────────────────

test.describe('Metrics API — field regression', () => {
  test('GET /api/metrics/system has cpuUsagePercent, memoryUsagePercent, disks[], networkInterfaces[]', async ({ request, baseURL }) => {
    const token = await login(request, baseURL!);
    const res = await request.get(`${baseURL}/api/metrics/system`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body.cpuUsagePercent).toBe('number');
    expect(typeof body.memoryUsagePercent).toBe('number');
    expect(Array.isArray(body.disks)).toBe(true);
    expect(Array.isArray(body.networkInterfaces)).toBe(true);
  });

  test('GET /api/metrics/system/history returns array', async ({ request, baseURL }) => {
    const token = await login(request, baseURL!);
    const from = new Date(Date.now() - 6 * 60 * 1000).toISOString();
    const res = await request.get(`${baseURL}/api/metrics/system/history?from=${from}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
  });

  test('GET /api/metrics/live returns object', async ({ request, baseURL }) => {
    const token = await login(request, baseURL!);
    const res = await request.get(`${baseURL}/api/metrics/live`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    expect(typeof await res.json()).toBe('object');
  });
});

// ─── Services ─────────────────────────────────────────────────────────────────

test.describe('Services API', () => {
  test('GET /api/services returns array', async ({ request, baseURL }) => {
    const token = await login(request, baseURL!);
    const res = await request.get(`${baseURL}/api/services`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
  });
});

// ─── Settings ─────────────────────────────────────────────────────────────────

test.describe('Settings API', () => {
  test('GET /api/settings returns object', async ({ request, baseURL }) => {
    const token = await login(request, baseURL!);
    const res = await request.get(`${baseURL}/api/settings`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    expect(typeof await res.json()).toBe('object');
  });
});
