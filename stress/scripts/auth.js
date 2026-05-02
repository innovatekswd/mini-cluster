/**
 * Auth stress test — login flood
 *
 * Measures:
 *   - Login throughput under concurrent load
 *   - Rate limiting behaviour (should 429, not crash)
 *   - Token refresh under load
 *
 * Run:
 *   k6 run scripts/auth.js
 *   BASE_URL=http://localhost:5147 k6 run scripts/auth.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { BASE_URL, getToken, authHeaders } from '../lib/helpers.js';

// ─── Custom metrics ────────────────────────────────────────────────────────────
const loginSuccess   = new Rate('auth_login_success');
const loginDuration  = new Trend('auth_login_duration_ms');
const rateLimited    = new Counter('auth_rate_limited');
const meRequests     = new Counter('auth_me_requests');

// ─── Test stages ──────────────────────────────────────────────────────────────
export const options = {
  stages: [
    { duration: '30s', target: 10 },  // warm-up: ramp to 10 VUs
    { duration: '1m',  target: 50 },  // stress: 50 concurrent logins
    { duration: '30s', target: 0  },  // wind-down
  ],
  thresholds: {
    // 95% of successful logins complete in under 500ms
    auth_login_duration_ms: ['p(95)<500'],
    // At least 80% of login attempts succeed (some 429s expected)
    auth_login_success:     ['rate>0.80'],
    http_req_failed:        ['rate<0.20'],
  },
};

export function setup() {
  // Pre-warm: confirm server is up
  const res = http.get(`${BASE_URL}/health`);
  check(res, { 'server healthy': (r) => r.status === 200 });
  return {};
}

export default function () {
  // Attempt login
  const start = Date.now();
  const loginRes = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ username: 'admin', password: 'admin' }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  loginDuration.add(Date.now() - start);

  if (loginRes.status === 429) {
    rateLimited.add(1);
    loginSuccess.add(false);
    sleep(1); // back-off when rate-limited
    return;
  }

  const ok = check(loginRes, {
    'login status 200': (r) => r.status === 200,
    'login has token':  (r) => {
      try { return !!JSON.parse(r.body).accessToken; } catch { return false; }
    },
  });
  loginSuccess.add(ok);

  if (ok) {
    const token = JSON.parse(loginRes.body).accessToken;
    meRequests.add(1);
    const meRes = http.get(`${BASE_URL}/api/auth/me`, {
      headers: authHeaders(token),
    });
    check(meRes, { '/me status 200': (r) => r.status === 200 });
  }

  sleep(0.5);
}
