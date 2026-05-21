/**
 * Smoke test — baseline correctness
 *
 * What it validates:
 *  - All endpoints respond (200 or 429)
 *  - Rate limit headers are present
 *  - After exhausting a limiter, we get 429 with Retry-After
 *  - /health never returns 429
 *
 * Run:  k6 run k6/smoke.js
 *       npm run k6:smoke
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Tell k6 that 429 is an expected response, not a failure
http.setResponseCallback(http.expectedStatuses(200, 429));

const BASE = `http://127.0.0.1:${__ENV.PORT || '4999'}`;

const allowed  = new Counter('rl_allowed');
const blocked  = new Counter('rl_blocked');
const blockRate = new Rate('rl_block_rate');
const latency  = new Trend('rl_latency_ms', true);

export const options = {
  // Single VU, sequential requests — designed to exhaust one limiter and observe 429
  scenarios: {
    smoke: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 40,
      maxDuration: '30s',
    },
  },
  thresholds: {
    // At least one 429 must be observed (limits are intentionally low)
    rl_blocked:      ['count>0'],
    // With setResponseCallback, http_req_failed only counts connection errors (not 429)
    http_req_failed: ['rate<0.01'],
    rl_latency_ms:   ['p(95)<500'],
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function assertRateLimitHeaders(res, tag) {
  check(res, {
    [`${tag}: has X-RateLimit-Limit`]:     r => r.headers['X-Ratelimit-Limit'] !== undefined,
    [`${tag}: has X-RateLimit-Remaining`]: r => r.headers['X-Ratelimit-Remaining'] !== undefined,
    [`${tag}: has X-RateLimit-Reset`]:     r => r.headers['X-Ratelimit-Reset'] !== undefined,
  });
}

function hit(path, tag) {
  const start = Date.now();
  const res = http.get(`${BASE}${path}`);
  latency.add(Date.now() - start);

  const is429 = res.status === 429;
  const is200 = res.status === 200;

  check(res, {
    [`${tag}: status is 200 or 429`]: r => r.status === 200 || r.status === 429,
  });

  if (is200) {
    allowed.add(1);
    blockRate.add(false);
    assertRateLimitHeaders(res, tag);
  } else if (is429) {
    blocked.add(1);
    blockRate.add(true);
    assertRateLimitHeaders(res, tag);
    check(res, {
      [`${tag}: 429 has Retry-After`]: r => r.headers['Retry-After'] !== undefined,
      [`${tag}: 429 body has retryAfter`]: r => {
        try { return JSON.parse(r.body).retryAfter >= 0; } catch { return false; }
      },
    });
  }

  return { is200, is429, res };
}

// ── Test ──────────────────────────────────────────────────────────────────────

export default function () {
  // Health endpoint — should always be 200
  const health = http.get(`${BASE}/health`);
  check(health, { 'health: 200': r => r.status === 200 });

  // Hit token-bucket rapidly — bucket size is 10, so VU 1 will exhaust it
  hit('/api/token-bucket', 'token-bucket');

  // Hit fixed-window
  hit('/api/fixed-window', 'fixed-window');

  // Hit sliding-window-counter
  hit('/api/sliding-window', 'sliding-window');

  // Multi-weight — each call costs 3 tokens; after ~3 calls bucket is empty
  hit('/api/multi-weight', 'multi-weight');

  // Stats endpoint — never rate limited
  const stats = http.get(`${BASE}/stats`);
  check(stats, {
    'stats: 200': r => r.status === 200,
    'stats: has stats object': r => {
      try { return typeof JSON.parse(r.body).stats === 'object'; } catch { return false; }
    },
  });

  sleep(0.1);
}

export function handleSummary(data) {
  const allowed_count = data.metrics['rl_allowed']  ? data.metrics['rl_allowed'].values.count  : 0;
  const blocked_count = data.metrics['rl_blocked']  ? data.metrics['rl_blocked'].values.count  : 0;
  const total = allowed_count + blocked_count;

  console.log(`
┌── Smoke Test Summary ──────────────────────────────────────┐
│  Total endpoint hits : ${String(total).padEnd(34)}│
│  Allowed (200)       : ${String(allowed_count).padEnd(34)}│
│  Blocked (429)       : ${String(blocked_count).padEnd(34)}│
│  Block rate          : ${(total > 0 ? ((blocked_count / total) * 100).toFixed(1) : '0') + '%'}${' '.repeat(33 - (total > 0 ? ((blocked_count / total) * 100).toFixed(1) : '0').length)}│
└────────────────────────────────────────────────────────────┘
`);
  return {};
}
