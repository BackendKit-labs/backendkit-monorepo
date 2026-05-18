// auto-learning.k6.js
//
// Observes how AutoLearningCore tunes TunableConfig across three phases:
//
//   Phase 1 — Baseline  (0 – 50s):  5 VUs, low error rate (5%)
//   Phase 2 — Stress    (50–110s): 25 VUs, high error rate (85%), high latency (1000ms)
//   Phase 3 — Recovery  (110–160s): 5 VUs, minimal errors (2%)
//
// The feedback loop fires every 30s; cooldownMs is 60s so at most one config
// change per minute. Expected cycles with observable changes:
//   t≈30s  — baseline aggregate established
//   t≈60s  — stress data first seen
//   t≈90s  — cooldown cleared: timeoutMs ↑, maxRetries ↑, failureThreshold ↓
//   t≈120s — recovery data mixed in
//   t≈150s — clean traffic: config trends back toward defaults
//
// A dedicated "observer" scenario polls /health/auto-learning every 5s,
// records custom metrics, and logs config snapshots throughout.
//
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Gauge } from 'k6/metrics';

const BASE = __ENV.BASE_URL || 'http://localhost:3003';

// Custom metrics — visible in the k6 end-of-test summary
const alTimeoutMs        = new Trend('al_timeout_ms',          true);
const alMaxRetries       = new Gauge('al_max_retries');
const alFailureThreshold = new Gauge('al_failure_threshold');
const alBulkheadMax      = new Gauge('al_bulkhead_max_concurrent');

export const options = {
  scenarios: {
    // ── Load VUs ───────────────────────────────────────────────────────────
    baseline: {
      executor: 'ramping-vus',
      exec: 'runOrders',
      stages: [
        { duration: '10s', target: 5 },
        { duration: '40s', target: 5 },
      ],
    },
    stress: {
      executor: 'ramping-vus',
      exec: 'runOrders',
      startTime: '50s',
      stages: [
        { duration: '15s', target: 25 },
        { duration: '45s', target: 25 },
      ],
    },
    recovery: {
      executor: 'ramping-vus',
      exec: 'runOrders',
      startTime: '110s',
      stages: [
        { duration: '30s', target: 5 },
        { duration: '20s', target: 0 },
      ],
    },

    // ── Sim config switches ─────────────────────────────────────────────────
    applyStress: {
      executor: 'shared-iterations',
      exec: 'setStressConfig',
      startTime: '50s',
      iterations: 1,
      vus: 1,
    },
    applyRecovery: {
      executor: 'shared-iterations',
      exec: 'setRecoveryConfig',
      startTime: '110s',
      iterations: 1,
      vus: 1,
    },

    // ── Observer ────────────────────────────────────────────────────────────
    observer: {
      executor: 'constant-vus',
      exec: 'observe',
      vus: 1,
      duration: '160s',
    },
  },

  thresholds: {
    // Auto-learning health endpoint must always respond
    'checks{type:al-up}': ['rate==1.0'],
  },
};

// ── Lifecycle ─────────────────────────────────────────────────────────────────

export function setup() {
  // Reset simulator to clean baseline before the test starts
  const patch = http.patch(
    `${BASE}/sim/config`,
    JSON.stringify({ paymentFailureRate: 0.05, paymentDelayMs: 100 }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  if (patch.status !== 200) {
    console.error(`setup: PATCH /sim/config failed — ${patch.status} ${patch.body}`);
  } else {
    console.log('setup: baseline config applied (paymentFailureRate=0.05, paymentDelayMs=100)');
  }

  const res = http.get(`${BASE}/health/auto-learning`);
  if (res.status === 200) {
    const state = JSON.parse(res.body);
    console.log('setup: initial auto-learning config =', JSON.stringify(state.currentConfig));
    return { initialConfig: state.currentConfig };
  }
  return { initialConfig: null };
}

export function teardown(data) {
  // Always reset sim to a safe default
  http.patch(
    `${BASE}/sim/config`,
    JSON.stringify({ paymentFailureRate: 0.2, paymentDelayMs: 150 }),
    { headers: { 'Content-Type': 'application/json' } },
  );

  const res = http.get(`${BASE}/health/auto-learning`);
  if (res.status === 200) {
    const state = JSON.parse(res.body);
    const final   = state.currentConfig;
    const initial = data.initialConfig;

    console.log('\n=== auto-learning config evolution ===');
    if (initial) {
      console.log('initial:', JSON.stringify(initial));
    }
    console.log('final  :', JSON.stringify(final));

    if (initial) {
      const timeoutDelta    = final.httpClient.timeoutMs    - initial.httpClient.timeoutMs;
      const retriesDelta    = final.httpClient.maxRetries   - initial.httpClient.maxRetries;
      const thresholdDelta  = final.circuitBreaker.failureThreshold - initial.circuitBreaker.failureThreshold;

      console.log(`timeoutMs:        ${initial.httpClient.timeoutMs} → ${final.httpClient.timeoutMs} (${timeoutDelta >= 0 ? '+' : ''}${timeoutDelta})`);
      console.log(`maxRetries:       ${initial.httpClient.maxRetries} → ${final.httpClient.maxRetries} (${retriesDelta >= 0 ? '+' : ''}${retriesDelta})`);
      console.log(`failureThreshold: ${initial.circuitBreaker.failureThreshold} → ${final.circuitBreaker.failureThreshold} (${thresholdDelta >= 0 ? '+' : ''}${thresholdDelta})`);
    }
    console.log('======================================\n');
  }
}

// ── Sim config switches ───────────────────────────────────────────────────────

export function setStressConfig() {
  const res = http.patch(
    `${BASE}/sim/config`,
    JSON.stringify({ paymentFailureRate: 0.85, paymentDelayMs: 1000 }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  console.log(`[t=50s] stress config → paymentFailureRate=0.85 paymentDelayMs=1000 (${res.status})`);
}

export function setRecoveryConfig() {
  const res = http.patch(
    `${BASE}/sim/config`,
    JSON.stringify({ paymentFailureRate: 0.02, paymentDelayMs: 80 }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  console.log(`[t=110s] recovery config → paymentFailureRate=0.02 paymentDelayMs=80 (${res.status})`);
}

// ── Load generator ────────────────────────────────────────────────────────────

export function runOrders() {
  http.post(
    `${BASE}/orders`,
    JSON.stringify({
      customerId: 'cust-seed-1',
      items: [{ productId: 'prod-seed-1', variantId: 'var-seed-1', quantity: 1, unitPrice: 2999 }],
      paymentMethod: 'card',
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  sleep(0.3);
}

// ── Observer ──────────────────────────────────────────────────────────────────

export function observe() {
  sleep(5);

  const res = http.get(`${BASE}/health/auto-learning`, { tags: { type: 'al-up' } });
  const up = check(
    res,
    { 'auto-learning endpoint up': (r) => r.status === 200 },
    { type: 'al-up' },
  );

  if (!up) {
    console.error(`observe: /health/auto-learning returned ${res.status}`);
    return;
  }

  try {
    const state = JSON.parse(res.body);
    const cfg   = state.currentConfig;

    // Record custom metrics
    alTimeoutMs.add(cfg.httpClient.timeoutMs);
    alMaxRetries.add(cfg.httpClient.maxRetries);
    alFailureThreshold.add(cfg.circuitBreaker.failureThreshold);
    alBulkheadMax.add(cfg.bulkhead.maxConcurrentCalls);

    console.log(
      `[auto-learning]` +
      ` running=${state.running}` +
      ` | timeoutMs=${cfg.httpClient.timeoutMs}` +
      ` | maxRetries=${cfg.httpClient.maxRetries}` +
      ` | cbFailureThreshold=${cfg.circuitBreaker.failureThreshold}` +
      ` | bulkhead.maxConcurrent=${cfg.bulkhead.maxConcurrentCalls}`,
    );
  } catch (_) {
    console.error('observe: failed to parse /health/auto-learning response');
  }
}
