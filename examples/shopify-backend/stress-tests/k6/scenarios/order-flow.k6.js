import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const orderDuration = new Trend('order_pipeline_ms');
const orderFailRate = new Rate('order_fail_rate');

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '60s', target: 50 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'],
    order_fail_rate: ['rate<0.3'],
  },
};

const BASE = __ENV.BASE_URL || 'http://localhost:3003';

export default function () {
  const res = http.post(
    `${BASE}/orders`,
    JSON.stringify({
      customerId: 'cust-seed-1',
      items: [{ productId: 'prod-seed-1', variantId: 'var-seed-1', quantity: 1, unitPrice: 2999 }],
      paymentMethod: 'card',
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );

  const success = check(res, {
    'status 201': (r) => r.status === 201,
    'has transactionId': (r) => {
      try { return JSON.parse(r.body).order?.transactionId !== undefined; } catch { return false; }
    },
  });

  orderDuration.add(res.timings.duration);
  orderFailRate.add(!success);
  sleep(0.5);
}
