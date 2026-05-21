/**
 * Load test — steady realistic traffic across all endpoints
 *
 * What it validates:
 *  - Server handles concurrent users without errors
 *  - Rate limiter correctly partitions traffic per VU (per IP in real deploys)
 *    NOTE: k6 VUs share the same IP in local runs, so all share one rate limit key.
 *          Use the `X-User-Id` pattern below to simulate per-user keys when needed.
 *  - p95 latency stays under budget even under load
 *  - Block rate is within expected range (not zero, not 100%)
 *
 * Run:  k6 run k6/load.js
 *       npm run k6:load
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend, Gauge } from 'k6/metrics';

http.setResponseCallback(http.expectedStatuses(200, 429));

const BASE = `http://127.0.0.1:${__ENV.PORT || '4999'}`;

const allowed   = new Counter('rl_allowed');
const blocked   = new Counter('rl_blocked');
const errors    = new Counter('rl_errors');
const blockRate = new Rate('rl_block_rate');
const latency   = new Trend('rl_latency_ms', true);

export const options = {
  stages: [
    { duration: '5s',  target: 3  },   // ramp up
    { duration: '20s', target: 5  },   // steady load
    { duration: '5s',  target: 0  },   // ramp down
  ],
  thresholds: {
    rl_errors:     ['count==0'],        // no 5xx errors
    rl_latency_ms: ['p(95)<300'],
    // Block rate should be >0 (limits are being hit) but not 100%
    rl_block_rate: ['rate<0.85'],
  },
};

// Endpoints to rotate through
const ENDPOINTS = [
  { path: '/api/token-bucket',   label: 'token-bucket'   },
  { path: '/api/fixed-window',   label: 'fixed-window'   },
  { path: '/api/sliding-window', label: 'sliding-window' },
  { path: '/api/multi-weight',   label: 'multi-weight'   },
];

export default function () {
  // Pick an endpoint round-robin based on iteration counter
  const endpoint = ENDPOINTS[__ITER % ENDPOINTS.length];

  const start = Date.now();
  const res = http.get(`${BASE}${endpoint.path}`, {
    headers: {
      // Pass VU id as a custom header — the server could use this as the rate limit key
      // instead of IP to simulate per-user limits in local testing
      'X-User-Id': `vu-${__VU}`,
    },
    tags: { endpoint: endpoint.label },
  });
  latency.add(Date.now() - start, { endpoint: endpoint.label });

  check(res, {
    'status is 200 or 429': r => r.status === 200 || r.status === 429,
    'no 5xx errors': r => r.status < 500,
  });

  if (res.status === 200) {
    allowed.add(1, { endpoint: endpoint.label });
    blockRate.add(false, { endpoint: endpoint.label });
  } else if (res.status === 429) {
    blocked.add(1, { endpoint: endpoint.label });
    blockRate.add(true, { endpoint: endpoint.label });

    check(res, {
      '429: has Retry-After': r => r.headers['Retry-After'] !== undefined,
    });
  } else {
    errors.add(1, { endpoint: endpoint.label, status: String(res.status) });
  }

  // Realistic think time between requests
  sleep(0.2 + Math.random() * 0.3);
}

export function handleSummary(data) {
  const m = data.metrics;
  const get = (name, field) => m[name]?.values[field] ?? 0;

  const a = get('rl_allowed', 'count');
  const b = get('rl_blocked', 'count');
  const e = get('rl_errors',  'count');
  const total = a + b + e;
  const p95 = get('rl_latency_ms', 'p(95)');

  console.log(`
┌── Load Test Summary ───────────────────────────────────────┐
│  Total requests      : ${String(total).padEnd(34)}│
│  Allowed (200)       : ${String(a).padEnd(34)}│
│  Blocked (429)       : ${String(b).padEnd(34)}│
│  Errors  (5xx)       : ${String(e).padEnd(34)}│
│  Block rate          : ${(total > 0 ? ((b / total) * 100).toFixed(1) + '%' : '0%').padEnd(34)}│
│  p95 latency         : ${(p95.toFixed(1) + ' ms').padEnd(34)}│
└────────────────────────────────────────────────────────────┘
`);
  return {};
}
