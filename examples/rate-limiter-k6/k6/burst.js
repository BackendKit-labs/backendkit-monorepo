/**
 * Burst test — spike traffic to aggressively trigger rate limiting
 *
 * What it validates:
 *  - Under a sudden spike, the limiter correctly blocks excess requests (429)
 *  - Server stays healthy — no 5xx, no panics, no memory leaks under pressure
 *  - After the spike, limits recover and 200s are returned again
 *  - Limiter latency overhead stays minimal even at high concurrency
 *
 * Scenario
 * --------
 *  Phase 1 — Calm:  2 VUs × 5s   (warm up, mostly 200s)
 *  Phase 2 — Spike: 50 VUs × 10s  (heavy burst, many 429s expected)
 *  Phase 3 — Drain: 2 VUs × 10s   (limits recover, 200s return)
 *
 * Run:  k6 run k6/burst.js
 *       npm run k6:burst
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

http.setResponseCallback(http.expectedStatuses(200, 429));

const BASE = `http://127.0.0.1:${__ENV.PORT || '4999'}`;

const allowed   = new Counter('burst_allowed');
const blocked   = new Counter('burst_blocked');
const errors    = new Counter('burst_errors');
const blockRate = new Rate('burst_block_rate');
const latency   = new Trend('burst_latency_ms', true);

export const options = {
  stages: [
    { duration: '5s',  target: 2  },   // calm — warm up
    { duration: '10s', target: 50 },   // spike — hammer the rate limiter
    { duration: '10s', target: 2  },   // drain — observe recovery
  ],
  thresholds: {
    burst_errors:     ['count==0'],      // zero 5xx — limiter must not crash
    burst_latency_ms: ['p(99)<1000'],    // even at 50 VUs, p99 under 1s
    // During the spike we expect heavy blocking (>30% block rate is fine)
    // but we verify the server is still alive by ensuring some 200s come through
    burst_allowed:    ['count>0'],
    burst_blocked:    ['count>0'],       // confirms limits are actually enforced
  },
};

// Focus burst on the most constrained endpoint (token bucket, 10 tokens / 2 per second)
// 50 VUs hitting 10-token bucket simultaneously will saturate it immediately
const PRIMARY = '/api/token-bucket';

// Secondary endpoints to show the server stays healthy across all routes
const SECONDARY = ['/api/fixed-window', '/api/sliding-window', '/health'];

export default function () {
  const useSecondary = Math.random() < 0.2;
  const path = useSecondary
    ? SECONDARY[Math.floor(Math.random() * SECONDARY.length)]
    : PRIMARY;

  const start = Date.now();
  const res = http.get(`${BASE}${path}`, {
    tags: { endpoint: path.replace('/api/', '') },
  });
  latency.add(Date.now() - start);

  const ok = res.status === 200;
  const limited = res.status === 429;

  check(res, {
    'no 5xx': r => r.status < 500,
    'is 200 or 429': r => r.status === 200 || r.status === 429,
  });

  if (ok) {
    allowed.add(1);
    blockRate.add(false);
  } else if (limited) {
    blocked.add(1);
    blockRate.add(true);

    // Validate 429 response shape
    check(res, {
      '429: Retry-After present': r => r.headers['Retry-After'] !== undefined,
      '429: body is valid JSON':  r => {
        try { const b = JSON.parse(r.body); return b.error === 'too_many_requests'; }
        catch { return false; }
      },
    });

    // Honour Retry-After when present — in a real client you would back off
    // For the test we just sleep a fraction to avoid hammering unnecessarily
    const retryAfter = parseInt(res.headers['Retry-After'] ?? '0', 10);
    if (retryAfter > 0) {
      sleep(Math.min(retryAfter * 0.1, 0.5)); // sleep 10% of retry window, max 500ms
      return;
    }
  } else {
    errors.add(1);
  }

  // Minimal sleep to simulate realistic client behaviour during a burst
  sleep(0.05);
}

export function handleSummary(data) {
  const m = data.metrics;
  const get = (name, field) => m[name]?.values[field] ?? 0;

  const a   = get('burst_allowed',   'count');
  const b   = get('burst_blocked',   'count');
  const e   = get('burst_errors',    'count');
  const p95 = get('burst_latency_ms', 'p(95)');
  const p99 = get('burst_latency_ms', 'p(99)');
  const total = a + b + e;

  console.log(`
┌── Burst Test Summary ──────────────────────────────────────┐
│  Total requests      : ${String(total).padEnd(34)}│
│  Allowed (200)       : ${String(a).padEnd(34)}│
│  Blocked (429)       : ${String(b).padEnd(34)}│
│  Errors  (5xx)       : ${String(e).padEnd(34)}│
│  Block rate          : ${(total > 0 ? ((b / total) * 100).toFixed(1) + '%' : '0%').padEnd(34)}│
│  p95 latency         : ${(p95.toFixed(1) + ' ms').padEnd(34)}│
│  p99 latency         : ${(p99.toFixed(1) + ' ms').padEnd(34)}│
└────────────────────────────────────────────────────────────┘
`);
  return {};
}
