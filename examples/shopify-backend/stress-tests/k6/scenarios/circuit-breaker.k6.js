// Ramps to 30 VUs. With PAYMENT_FAILURE_RATE=0.8, circuit should open.
// Polls /health/circuit-breakers to observe state transitions.
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '20s', target: 5 },
    { duration: '40s', target: 30 },
    { duration: '20s', target: 5 },
    { duration: '20s', target: 0 },
  ],
};

const BASE = __ENV.BASE_URL || 'http://localhost:3003';

export default function () {
  // Fire an order (will fail payment at high rate)
  http.post(
    `${BASE}/orders`,
    JSON.stringify({
      customerId: 'cust-seed-1',
      items: [{ productId: 'prod-seed-1', variantId: 'var-seed-1', quantity: 1, unitPrice: 2999 }],
      paymentMethod: 'card',
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );

  // Check circuit state
  const health = http.get(`${BASE}/health/circuit-breakers`);
  check(health, { 'health reachable': (r) => r.status === 200 });
  sleep(0.2);
}
