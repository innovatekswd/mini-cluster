/**
 * API Read throughput stress test
 *
 * Measures read performance of the core list endpoints under concurrent load.
 * These endpoints are called on every dashboard load and page refresh.
 *
 * Endpoints exercised:
 *   GET /api/apps
 *   GET /api/services
 *   GET /api/envs
 *   GET /api/envs/active
 *   GET /api/metrics/system
 *   GET /api/settings
 *
 * Run:
 *   k6 run scripts/api-read.js
 *   k6 run --duration 10m scripts/api-read.js   # soak test
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';
import { BASE_URL, getToken, authHeaders } from '../lib/helpers.js';

// ─── Custom metrics ────────────────────────────────────────────────────────────
const appsLatency     = new Trend('read_apps_ms');
const servicesLatency = new Trend('read_services_ms');
const envsLatency     = new Trend('read_envs_ms');
const metricsLatency  = new Trend('read_metrics_ms');
const dashboardError  = new Rate('dashboard_errors');

// ─── Test stages ──────────────────────────────────────────────────────────────
export const options = {
  stages: [
    { duration: '30s', target: 20  },  // ramp-up
    { duration: '2m',  target: 100 },  // steady: 100 concurrent users
    { duration: '1m',  target: 200 },  // push: 200 users (high load)
    { duration: '30s', target: 0   },  // wind-down
  ],
  thresholds: {
    // p95 response times (ms)
    read_apps_ms:     ['p(95)<300'],
    read_services_ms: ['p(95)<300'],
    read_envs_ms:     ['p(95)<300'],
    read_metrics_ms:  ['p(95)<500'],  // metrics is heavier (disk/cpu collection)
    // Error rate
    dashboard_errors: ['rate<0.01'],
    http_req_failed:  ['rate<0.05'],
  },
};

export function setup() {
  return { token: getToken() };
}

export default function ({ token }) {
  const headers = authHeaders(token);

  group('dashboard load simulation', () => {
    // Replicate exactly what the React dashboard requests on mount
    const batch = http.batch([
      ['GET', `${BASE_URL}/api/apps`,             null, { headers }],
      ['GET', `${BASE_URL}/api/services`,         null, { headers }],
      ['GET', `${BASE_URL}/api/envs/active`,      null, { headers }],
      ['GET', `${BASE_URL}/api/metrics/system`,   null, { headers }],
      ['GET', `${BASE_URL}/api/settings`,         null, { headers }],
    ]);

    const [appsRes, svcsRes, envRes, metricsRes, settingsRes] = batch;

    appsLatency.add(appsRes.timings.duration);
    servicesLatency.add(svcsRes.timings.duration);
    envsLatency.add(envRes.timings.duration);
    metricsLatency.add(metricsRes.timings.duration);

    const ok = check(batch, {
      'apps 200':      () => appsRes.status     === 200,
      'services 200':  () => svcsRes.status     === 200,
      'envs/active 200': () => envRes.status    === 200,
      'metrics 200':   () => metricsRes.status  === 200,
      'settings 200':  () => settingsRes.status === 200,
    });
    dashboardError.add(!ok);
  });

  group('apps list', () => {
    const res = http.get(`${BASE_URL}/api/apps`, { headers });
    appsLatency.add(res.timings.duration);
    check(res, { 'apps list 200': (r) => r.status === 200 });
  });

  group('environments list', () => {
    const res = http.get(`${BASE_URL}/api/envs`, { headers });
    envsLatency.add(res.timings.duration);
    check(res, { 'envs list 200': (r) => r.status === 200 });
  });

  sleep(0.2);
}
