/**
 * Metrics collection stress test
 *
 * Many concurrent clients polling the metrics endpoints — the main scenario
 * that stresses gopsutil's CPU/memory/disk collection and the in-memory
 * history ring buffer.
 *
 * Endpoints:
 *   GET /api/metrics/system         — real-time system snapshot
 *   GET /api/metrics/system/history — N-minute history ring
 *   GET /api/metrics/live           — per-process metrics map
 *
 * Run:
 *   k6 run scripts/metrics.js
 *   k6 run --duration 5m scripts/metrics.js   # sustained polling test
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { BASE_URL, getToken, authHeaders } from '../lib/helpers.js';

// ─── Custom metrics ────────────────────────────────────────────────────────────
const systemLatency  = new Trend('metrics_system_ms');
const historyLatency = new Trend('metrics_history_ms');
const liveLatency    = new Trend('metrics_live_ms');
const metricsErrors  = new Rate('metrics_errors');
const missingFields  = new Counter('metrics_missing_fields');

// ─── Test stages ──────────────────────────────────────────────────────────────
export const options = {
  // Simulate 50 dashboard clients each polling every 2 seconds
  scenarios: {
    dashboard_pollers: {
      executor:       'constant-vus',
      vus:            50,
      duration:       '2m',
    },
    surge: {
      executor:       'ramping-vus',
      startVUs:       0,
      stages: [
        { duration: '30s', target: 150 },  // spike to 150 simultaneous
        { duration: '30s', target: 0 },
      ],
      startTime: '2m',  // starts after the steady phase
    },
  },
  thresholds: {
    metrics_system_ms:  ['p(95)<800', 'p(99)<2000'],
    metrics_history_ms: ['p(95)<500'],
    metrics_live_ms:    ['p(95)<500'],
    metrics_errors:     ['rate<0.02'],
    http_req_failed:    ['rate<0.05'],
  },
};

export function setup() {
  return { token: getToken() };
}

export default function ({ token }) {
  const headers = authHeaders(token);

  group('system snapshot', () => {
    const res = http.get(`${BASE_URL}/api/metrics/system`, { headers });
    systemLatency.add(res.timings.duration);

    const ok = check(res, { 'system 200': (r) => r.status === 200 });
    metricsErrors.add(!ok);

    if (ok) {
      try {
        const body = JSON.parse(res.body);
        // Verify the critical fields that crashed the UI when missing
        const hasFields =
          typeof body.cpuUsagePercent    === 'number' &&
          typeof body.memoryUsagePercent === 'number' &&
          Array.isArray(body.disks)                   &&
          Array.isArray(body.networkInterfaces);
        if (!hasFields) missingFields.add(1);
        check(res, {
          'has cpuUsagePercent':    () => typeof body.cpuUsagePercent === 'number',
          'has memoryUsagePercent': () => typeof body.memoryUsagePercent === 'number',
          'disks is array':         () => Array.isArray(body.disks),
          'networkInterfaces array':() => Array.isArray(body.networkInterfaces),
        });
      } catch { missingFields.add(1); }
    }
  });

  group('history ring', () => {
    const from = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const res  = http.get(`${BASE_URL}/api/metrics/system/history?from=${from}`, { headers });
    historyLatency.add(res.timings.duration);
    check(res, {
      'history 200':   (r) => r.status === 200,
      'history array': (r) => { try { return Array.isArray(JSON.parse(r.body)); } catch { return false; } },
    });
  });

  group('live process metrics', () => {
    const res = http.get(`${BASE_URL}/api/metrics/live`, { headers });
    liveLatency.add(res.timings.duration);
    check(res, { 'live 200': (r) => r.status === 200 });
  });

  // Simulate a 2-second polling interval (React TanStack Query refetchInterval)
  sleep(2);
}
