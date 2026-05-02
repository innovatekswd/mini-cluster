/**
 * Concurrent mixed-operations stress test
 *
 * Simulates realistic production traffic: a mix of reads AND writes happening
 * simultaneously across different API domains.  This surfaces DB write
 * contention and process-manager lock contention.
 *
 * Scenario weights:
 *   60% — read (apps/services/metrics — dashboard polling)
 *   20% — service CRUD write
 *   10% — environment update
 *   10% — settings read/write
 *
 * Run:
 *   k6 run scripts/concurrent-ops.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { BASE_URL, getToken, authHeaders } from '../lib/helpers.js';

// ─── Custom metrics ────────────────────────────────────────────────────────────
const writeLatency = new Trend('concurrent_write_ms');
const readLatency  = new Trend('concurrent_read_ms');
const errors       = new Rate('concurrent_errors');

// ─── Test stages ──────────────────────────────────────────────────────────────
export const options = {
  stages: [
    { duration: '30s', target: 25  },
    { duration: '1m',  target: 75  },
    { duration: '1m',  target: 150 },  // main stress plateau
    { duration: '30s', target: 0   },
  ],
  thresholds: {
    concurrent_write_ms: ['p(95)<1000'],
    concurrent_read_ms:  ['p(95)<400'],
    concurrent_errors:   ['rate<0.05'],
    http_req_failed:     ['rate<0.10'],
  },
};

export function setup() {
  return { token: getToken() };
}

export default function ({ token }) {
  const headers = authHeaders(token);
  const roll    = Math.random();

  if (roll < 0.60) {
    // ── Read path (dashboard) ──────────────────────────────────────────────
    group('dashboard read', () => {
      const t0 = Date.now();
      const batch = http.batch([
        ['GET', `${BASE_URL}/api/services`,       null, { headers }],
        ['GET', `${BASE_URL}/api/metrics/system`, null, { headers }],
        ['GET', `${BASE_URL}/api/apps`,           null, { headers }],
      ]);
      readLatency.add(Date.now() - t0);
      const ok = check(batch, {
        'services ok':  () => batch[0].status === 200,
        'metrics ok':   () => batch[1].status === 200,
        'apps ok':      () => batch[2].status === 200,
      });
      errors.add(!ok);
    });

  } else if (roll < 0.80) {
    // ── Service CRUD write ─────────────────────────────────────────────────
    group('service write', () => {
      const t0       = Date.now();
      const createRes = http.post(
        `${BASE_URL}/api/services`,
        JSON.stringify({
          name:    `concurrent-${__VU}-${__ITER}`,
          command: 'echo',
          arguments: 'concurrent',
        }),
        { headers },
      );
      writeLatency.add(Date.now() - t0);

      const ok = check(createRes, { 'create ok': (r) => r.status === 200 || r.status === 201 });
      errors.add(!ok);

      if (ok) {
        try {
          const id = JSON.parse(createRes.body).id;
          // Immediately delete — measures create+delete throughput
          http.del(`${BASE_URL}/api/services/${id}`, null, { headers });
        } catch {}
      }
    });

  } else if (roll < 0.90) {
    // ── Environment read/write ─────────────────────────────────────────────
    group('env operations', () => {
      const listRes = http.get(`${BASE_URL}/api/envs`, { headers });
      check(listRes, { 'envs list ok': (r) => r.status === 200 });
      const activeRes = http.get(`${BASE_URL}/api/envs/active`, { headers });
      check(activeRes, { 'envs active ok': (r) => r.status === 200 });
    });

  } else {
    // ── Settings read/write ────────────────────────────────────────────────
    group('settings operations', () => {
      const getRes = http.get(`${BASE_URL}/api/settings`, { headers });
      const ok = check(getRes, { 'settings get ok': (r) => r.status === 200 });
      if (ok) {
        // Write back the same settings to test concurrent writes
        const settings = JSON.parse(getRes.body);
        const putRes = http.put(
          `${BASE_URL}/api/settings`,
          JSON.stringify(settings),
          { headers },
        );
        check(putRes, { 'settings put ok': (r) => r.status >= 200 && r.status < 300 });
      }
    });
  }

  sleep(0.1 + Math.random() * 0.4);  // 100-500ms think time
}

export function teardown({ token }) {
  // Clean up any leftover concurrent-* services
  const headers = authHeaders(token);
  const res = http.get(`${BASE_URL}/api/services`, { headers });
  if (res.status !== 200) return;
  try {
    for (const svc of JSON.parse(res.body)) {
      if (svc.name && svc.name.startsWith('concurrent-')) {
        http.del(`${BASE_URL}/api/services/${svc.id}`, null, { headers });
      }
    }
  } catch {}
}
