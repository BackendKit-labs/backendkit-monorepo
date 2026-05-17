import http from 'k6/http';
import { check } from 'k6';

export const options = { vus: 5, iterations: 50 };

const BASE = __ENV.BASE_URL || 'http://localhost:3000';

const attacks = [
  { event: "'; DROP TABLE orders; --", payload: {}, source: 'sqli-test', timestamp: new Date().toISOString() },
  { event: '<script>alert(1)</script>', payload: {}, source: 'xss-test', timestamp: new Date().toISOString() },
  { event: 'normal-event', payload: { key: '../../../etc/passwd' }, source: 'traversal-test', timestamp: new Date().toISOString() },
];

export default function () {
  const attack = attacks[Math.floor(Math.random() * attacks.length)];
  const res = http.post(`${BASE}/webhooks/shopify`, JSON.stringify(attack), {
    headers: { 'Content-Type': 'application/json', 'x-api-key': 'dev-key' },
  });
  check(res, { 'WAF blocked (403)': (r) => r.status === 403 });

  // Clean payload should pass
  const clean = http.post(
    `${BASE}/webhooks/shopify`,
    JSON.stringify({
      event: 'order.created',
      payload: { id: '123' },
      source: 'shopify',
      timestamp: new Date().toISOString(),
    }),
    { headers: { 'Content-Type': 'application/json', 'x-api-key': 'dev-key' } },
  );
  check(clean, { 'clean payload passes (201)': (r) => r.status === 201 });
}
