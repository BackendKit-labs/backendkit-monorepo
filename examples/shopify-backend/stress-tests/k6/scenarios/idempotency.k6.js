/**
 * Idempotency stress test
 *
 * Scenarios:
 *   normal       — unique key per VU+iter → expect 201 every time
 *   replay       — same key twice in a row → expect 201 then 201 with Idempotent-Replayed: true
 *   missing_key  — no Idempotency-Key header → expect 422
 *   invalid_key  — key with invalid chars → expect 422
 */
import http   from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Counter } from 'k6/metrics';

const replayRate    = new Rate('idempotency_replay_rate');
const missingErrors = new Counter('idempotency_missing_key_errors');
const invalidErrors = new Counter('idempotency_invalid_key_errors');
const failRate      = new Rate('idempotency_fail_rate');

export const options = {
  scenarios: {
    normal: {
      executor:    'ramping-vus',
      startVUs:    0,
      stages: [
        { duration: '20s', target: 20 },
        { duration: '30s', target: 20 },
        { duration: '10s', target: 0 },
      ],
      gracefulRampDown: '5s',
      exec: 'normalFlow',
    },
    replay: {
      executor:  'constant-vus',
      vus:       5,
      duration:  '60s',
      startTime: '0s',
      exec: 'replayFlow',
    },
    missing_key: {
      executor:  'shared-iterations',
      vus:       3,
      iterations: 30,
      startTime: '5s',
      exec: 'missingKeyFlow',
    },
    invalid_key: {
      executor:  'shared-iterations',
      vus:       3,
      iterations: 30,
      startTime: '5s',
      exec: 'invalidKeyFlow',
    },
  },
  thresholds: {
    idempotency_fail_rate:           ['rate<0.05'],
    idempotency_missing_key_errors:  ['count>0'],   // we expect some 422s
    idempotency_invalid_key_errors:  ['count>0'],
    http_req_duration:               ['p(95)<3000'],
  },
};

const BASE = __ENV.BASE_URL || 'http://localhost:3003';

const ORDER_PAYLOAD = JSON.stringify({
  customerId: 'cust-seed-1',
  items: [{ productId: 'prod-seed-1', variantId: 'var-seed-1', quantity: 1, unitPrice: 2999 }],
  paymentMethod: 'card',
});

function postOrder(idempotencyKey) {
  const headers = { 'Content-Type': 'application/json' };
  if (idempotencyKey !== undefined) headers['Idempotency-Key'] = idempotencyKey;
  return http.post(`${BASE}/orders`, ORDER_PAYLOAD, { headers });
}

// ── Normal flow: unique key per VU+iter ───────────────────────────────────────
export function normalFlow() {
  const key = `normal-${__VU}-${__ITER}`;
  const res = postOrder(key);

  const ok = check(res, {
    'normal: status 201': (r) => r.status === 201,
    'normal: not replayed': (r) => r.headers['Idempotent-Replayed'] !== 'true',
  });
  failRate.add(!ok);
  sleep(0.3);
}

// ── Replay flow: same key twice, second must come back as replayed ─────────────
export function replayFlow() {
  const key = `replay-${__VU}`;   // same key repeated every iteration per VU

  // First call — may already be cached from a previous iter
  const first = postOrder(key);
  check(first, {
    'replay first: 201 or replay': (r) => r.status === 201,
  });

  // Second call with same key — must be a replay
  const second = postOrder(key);
  const replayed = check(second, {
    'replay second: status 201':          (r) => r.status === 201,
    'replay second: Idempotent-Replayed': (r) => r.headers['Idempotent-Replayed'] === 'true',
  });
  replayRate.add(replayed);
  sleep(0.5);
}

// ── Missing key: no header → 422 ─────────────────────────────────────────────
export function missingKeyFlow() {
  const res = postOrder(undefined);
  const ok = check(res, {
    'missing key: status 422': (r) => r.status === 422,
  });
  if (ok) missingErrors.add(1);
  sleep(0.2);
}

// ── Invalid key: > 256 printable chars → 422 ─────────────────────────────────
const LONG_KEY = 'x'.repeat(300);
export function invalidKeyFlow() {
  const res = postOrder(LONG_KEY);
  const ok = check(res, {
    'invalid key: status 422': (r) => r.status === 422,
  });
  if (ok) invalidErrors.add(1);
  sleep(0.2);
}

export function handleSummary(data) {
  const replay  = (data.metrics.idempotency_replay_rate?.values?.rate  ?? 0) * 100;
  const missing = data.metrics.idempotency_missing_key_errors?.values?.count ?? 0;
  const invalid = data.metrics.idempotency_invalid_key_errors?.values?.count ?? 0;
  const fail    = (data.metrics.idempotency_fail_rate?.values?.rate ?? 0) * 100;
  const p95     = data.metrics.http_req_duration?.values?.['p(95)'] ?? 0;

  console.log('\n═══════════════════════════════════════════════');
  console.log('       IDEMPOTENCY TEST SUMMARY');
  console.log('═══════════════════════════════════════════════');
  console.log(`  Replay success rate:     ${replay.toFixed(1)}%`);
  console.log(`  Missing-key 422s:        ${missing}`);
  console.log(`  Invalid-key 422s:        ${invalid}`);
  console.log(`  Overall fail rate:       ${fail.toFixed(1)}%`);
  console.log(`  p95 latency:             ${p95.toFixed(0)} ms`);
  console.log('═══════════════════════════════════════════════\n');

  return {};
}
