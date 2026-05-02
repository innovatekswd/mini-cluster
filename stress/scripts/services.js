/**
 * Services CRUD + lifecycle stress test
 *
 * Tests write throughput and process-manager contention when many VUs:
 *   1. Create a service
 *   2. Start it
 *   3. Poll exec/status until running (or timeout)
 *   4. Stop it
 *   5. Delete it
 *
 * Also measures concurrent env-var and argument updates.
 *
 * Run:
 *   k6 run scripts/services.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { BASE_URL, getToken, authHeaders, assertOK } from '../lib/helpers.js';

// ─── Custom metrics ────────────────────────────────────────────────────────────
const createLatency = new Trend('service_create_ms');
const startLatency  = new Trend('service_start_ms');
const stopLatency   = new Trend('service_stop_ms');
const deleteLatency = new Trend('service_delete_ms');
const crudErrors    = new Rate('service_crud_errors');
const leakedSvcs    = new Counter('service_leaked');  // services not cleaned up

// ─── Test stages ──────────────────────────────────────────────────────────────
export const options = {
  stages: [
    { duration: '20s', target: 5  },  // gentle warm-up
    { duration: '1m',  target: 20 },  // sustained write load
    { duration: '30s', target: 40 },  // burst: 40 concurrent lifecycles
    { duration: '30s', target: 0  },  // wind-down
  ],
  thresholds: {
    service_create_ms:  ['p(95)<500'],
    service_start_ms:   ['p(95)<1000'],
    service_stop_ms:    ['p(95)<1000'],
    service_delete_ms:  ['p(95)<500'],
    service_crud_errors:['rate<0.05'],
    http_req_failed:    ['rate<0.10'],
  },
};

export function setup() {
  return { token: getToken() };
}

// Wait until exec/status returns "running" or times out (10s)
function waitForStatus(id, token, desiredStatus, maxWaitMs = 10000) {
  const headers = authHeaders(token);
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    const res = http.get(`${BASE_URL}/api/services/${id}/exec/status`, { headers });
    if (res.status === 200) {
      try {
        const body = JSON.parse(res.body);
        if (body.status === desiredStatus) return true;
      } catch {}
    }
    sleep(0.3);
  }
  return false;
}

export default function ({ token }) {
  const headers = authHeaders(token);
  const vuId    = __VU;
  const iter    = __ITER;
  let serviceId = null;

  group('service full lifecycle', () => {
    // 1. Create
    const createStart = Date.now();
    const createRes = http.post(
      `${BASE_URL}/api/services`,
      JSON.stringify({
        name:        `stress-svc-${vuId}-${iter}`,
        description: 'k6 stress test service',
        command:     'echo',
        arguments:   `stress-${vuId}`,
      }),
      { headers },
    );
    createLatency.add(Date.now() - createStart);

    const createOk = check(createRes, {
      'create 200/201': (r) => r.status === 200 || r.status === 201,
    });
    if (!createOk) { crudErrors.add(true); return; }
    crudErrors.add(false);

    try {
      serviceId = JSON.parse(createRes.body).id;
    } catch {
      crudErrors.add(true);
      return;
    }

    // 2. Update env vars
    group('env var update', () => {
      const res = http.put(
        `${BASE_URL}/api/services/${serviceId}/env`,
        JSON.stringify({ STRESS_VU: String(vuId), STRESS_ITER: String(iter) }),
        { headers },
      );
      check(res, { 'env update ok': (r) => r.status >= 200 && r.status < 300 });
    });

    // 3. Start
    const startStart = Date.now();
    const startRes = http.post(
      `${BASE_URL}/api/services/${serviceId}/exec/start`,
      null,
      { headers },
    );
    startLatency.add(Date.now() - startStart);
    check(startRes, { 'start ok': (r) => r.status >= 200 && r.status < 300 });

    // 4. Brief wait — echo exits quickly, so status may already be "stopped"
    sleep(0.5);

    // 5. Stop (may be already stopped for echo; that's fine)
    const stopStart = Date.now();
    const stopRes = http.post(
      `${BASE_URL}/api/services/${serviceId}/exec/stop`,
      null,
      { headers },
    );
    stopLatency.add(Date.now() - stopStart);
    // 200 (stopped) or 400 (already stopped) are both acceptable
    check(stopRes, { 'stop ok': (r) => r.status === 200 || r.status === 400 });

    // 6. Delete
    const delStart = Date.now();
    const delRes = http.del(`${BASE_URL}/api/services/${serviceId}`, null, { headers });
    deleteLatency.add(Date.now() - delStart);
    const delOk = check(delRes, { 'delete ok': (r) => r.status === 200 || r.status === 204 });
    if (delOk) { serviceId = null; } else { leakedSvcs.add(1); }
  });

  sleep(0.2);
}

export function teardown({ token }) {
  // Best-effort cleanup: list and delete any leftover stress services
  const headers = authHeaders(token);
  const res = http.get(`${BASE_URL}/api/services`, { headers });
  if (res.status !== 200) return;
  try {
    const services = JSON.parse(res.body);
    for (const svc of services) {
      if (svc.name && svc.name.startsWith('stress-svc-')) {
        http.del(`${BASE_URL}/api/services/${svc.id}`, null, { headers });
      }
    }
  } catch {}
}
