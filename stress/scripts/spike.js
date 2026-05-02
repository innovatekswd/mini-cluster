/**
 * Spike test — sudden traffic burst
 *
 * Simulates a sudden surge (e.g., many operators opening the dashboard
 * simultaneously after an incident).  Tests whether the API recovers
 * gracefully after the spike rather than staying degraded.
 *
 * Run:
 *   k6 run scripts/spike.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { BASE_URL, getToken, authHeaders } from '../lib/helpers.js';

const latency = new Trend('spike_latency_ms');
const errors  = new Rate('spike_errors');

export const options = {
  stages: [
    { duration: '10s', target: 5   },  // baseline
    { duration: '5s',  target: 300 },  // instant spike to 300
    { duration: '30s', target: 300 },  // sustain the spike
    { duration: '5s',  target: 5   },  // drop back to baseline
    { duration: '1m',  target: 5   },  // recovery observation window
    { duration: '5s',  target: 0   },
  ],
  thresholds: {
    spike_latency_ms: ['p(99)<5000'],   // even at peak, p99 under 5s
    spike_errors:     ['rate<0.10'],    // allow up to 10% errors during spike
    http_req_failed:  ['rate<0.15'],
  },
};

export function setup() {
  return { token: getToken() };
}

export default function ({ token }) {
  const headers = authHeaders(token);

  const t0  = Date.now();
  const res = http.get(`${BASE_URL}/api/metrics/system`, { headers });
  latency.add(Date.now() - t0);

  const ok = check(res, { '2xx': (r) => r.status >= 200 && r.status < 300 });
  errors.add(!ok);

  sleep(0.5);
}
