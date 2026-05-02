/**
 * Shared helpers for MiniCluster stress tests.
 *
 * Usage in each script:
 *   import { getToken, authHeaders, BASE_URL } from '../lib/helpers.js';
 */

import http from 'k6/http';
import { check } from 'k6';

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';

let _token = null;

/**
 * Login once and cache the token.
 * Call from setup() in k6 scripts and pass the result to default().
 */
export function getToken(username = 'admin', password = 'admin') {
  const res = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ username, password }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(res, { 'login 200': (r) => r.status === 200 });
  const body = JSON.parse(res.body);
  return body.accessToken;
}

/** Returns headers object with Bearer token. */
export function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

/** Asserts status is in the 2xx range. */
export function assertOK(res, tag) {
  check(res, { [`${tag} 2xx`]: (r) => r.status >= 200 && r.status < 300 });
}
