// Ramps to 30 VUs with PAYMENT_FAILURE_RATE=0.8 (set via /sim/config).
// Polls /health/circuit-breakers to observe payment-gateway CB state transitions.
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '20s', target: 5  },
    { duration: '40s', target: 30 },
    { duration: '20s', target: 5  },
    { duration: '20s', target: 0  },
  ],
  thresholds: {
    'checks{type:health}': ['rate==1.0'],
  },
};

const BASE = __ENV.BASE_URL || 'http://localhost:3003';
const PAYMENT_FAILURE_RATE = parseFloat(__ENV.PAYMENT_FAILURE_RATE || '0.8');

export function setup() {
  const res = http.patch(
    `${BASE}/sim/config`,
    JSON.stringify({ paymentFailureRate: PAYMENT_FAILURE_RATE }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  if (res.status !== 200) {
    console.error(`setup: could not set paymentFailureRate — ${res.status} ${res.body}`);
  } else {
    console.log(`setup: paymentFailureRate set to ${PAYMENT_FAILURE_RATE}`);
  }
}

export function teardown() {
  http.patch(
    `${BASE}/sim/config`,
    JSON.stringify({ paymentFailureRate: 0.2 }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  console.log('teardown: paymentFailureRate reset to 0.2');
}

export default function () {
  // Fire an order — will fail at high rate, driving the payment CB open
  http.post(
    `${BASE}/orders`,
    JSON.stringify({
      customerId: 'cust-seed-1',
      items: [{ productId: 'prod-seed-1', variantId: 'var-seed-1', quantity: 1, unitPrice: 2999 }],
      paymentMethod: 'card',
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );

  // Poll circuit breaker state
  const health = http.get(`${BASE}/health/circuit-breakers`, { tags: { type: 'health' } });
  check(health, { 'health reachable': (r) => r.status === 200 }, { type: 'health' });

  try {
    const cbs = JSON.parse(health.body);
    const pg  = cbs['payment-gateway'];
    if (pg) {
      console.log(
        `CB payment-gateway | state=${pg.state} failureRate=${pg.failureRate}% ` +
        `buffered=${pg.bufferedCalls} notPermitted=${pg.notPermittedCalls}`,
      );
    }
  } catch (_) { /* ignore parse errors */ }

  sleep(0.2);
}
