# Shopify Backend — BackendKit Labs Showcase

A production-grade NestJS Shopify-like backend that demonstrates every library in the BackendKit Labs suite. External calls (payment gateway, shipping provider) are simulated by an internal `SimulationModule` controller mounted at `/sim/*`, so no real external dependencies are required.

---

## Prerequisites

- **Node.js 20+** (LTS recommended)
- **k6** (optional) — for stress tests: https://k6.io/docs/get-started/installation/

> **Note:** `@backendkit-labs/request-scanner` is referenced via a local `file:` path (`../../packages/request-scanner`) to avoid needing a `GITHUB_TOKEN`. It is consumed directly from the monorepo source after being built. Ensure the package has been built (`npm run build` inside `packages/request-scanner`) before running this example.

---

## Installation

```bash
# 1. Navigate to the example
cd examples/shopify-backend

# 2. Install dependencies
npm install
```

---

## Running

```bash
# Development mode (watch + hot reload)
npm run start:dev

# Production build
npm run build && npm run start:prod
```

The server starts on `http://localhost:3000` by default.

On startup, `SeedService` automatically populates the in-memory store with 5 products, 5 inventory entries (100 units each), and 3 customers — all with deterministic IDs (`prod-seed-1` … `prod-seed-5`, `cust-seed-1` … `cust-seed-3`).

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Overall health + circuit breaker / bulkhead summaries |
| `GET` | `/health/circuit-breakers` | All circuit breaker metrics |
| `GET` | `/health/bulkheads` | All bulkhead metrics |
| `GET` | `/products` | List all products |
| `GET` | `/products/:id` | Get product by ID |
| `POST` | `/products` | Create a product |
| `PUT` | `/products/:id` | Update a product |
| `DELETE` | `/products/:id` | Delete a product |
| `GET` | `/customers` | List all customers |
| `GET` | `/customers/:id` | Get customer by ID |
| `GET` | `/customers/:id/orders/count` | Get order count for customer |
| `POST` | `/customers` | Create a customer |
| `GET` | `/inventory/:productId` | Get available stock |
| `POST` | `/inventory/:productId/reserve` | Reserve stock |
| `POST` | `/inventory/:productId/release` | Release a reservation |
| `GET` | `/orders` | List all orders |
| `GET` | `/orders/:id` | Get order by ID |
| `POST` | `/orders` | Create and process an order (runs full pipeline) |
| `POST` | `/payments/charge` | Directly charge a payment |
| `GET` | `/payments/:id` | Get payment record |
| `POST` | `/shipping/shipments` | Create a shipment |
| `GET` | `/shipping/shipments/:id/track` | Track a shipment |
| `POST` | `/webhooks/shopify` | Receive Shopify webhook (WAF-protected) |
| `POST` | `/sim/payment/charge` | Payment simulator |
| `POST` | `/sim/payment/refund` | Refund simulator |
| `POST` | `/sim/shipping/shipments` | Shipping simulator |
| `GET` | `/sim/shipping/shipments/:id` | Shipment tracking simulator |

### Quick order example

```bash
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "cust-seed-1",
    "items": [{"productId": "prod-seed-1", "variantId": "var-seed-1", "quantity": 1, "unitPrice": 2999}],
    "paymentMethod": "card"
  }'
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP port to listen on |
| `NODE_ENV` | `development` | Environment label used in logs |
| `LOG_LEVEL` | `info` | Log level: `debug`, `info`, `warn`, `error` |
| `PAYMENT_FAILURE_RATE` | `0.2` | Probability (0–1) that the payment simulator returns 500 |
| `PAYMENT_DELAY_MS` | `150` | Base latency (ms) added to every payment simulator call |
| `SHIPPING_FAILURE_RATE` | `0.15` | Probability (0–1) that the shipping simulator returns 500 |
| `SHIPPING_DELAY_MS` | `250` | Base latency (ms) added to every shipping simulator call |
| `EMAIL_FAILURE_RATE` | `0.05` | Probability (0–1) that the notification step silently fails (order still succeeds) |
| `GITHUB_TOKEN` | — | Required to install `@backendkit-labs/request-scanner` from GitHub Packages |

---

## BackendKit Libraries Demonstrated

| Library | Where Used |
|---------|-----------|
| `@backendkit-labs/circuit-breaker` | `PaymentsService`, `ShippingService` — `@WithCircuitBreaker` decorator; `CircuitBreakerRegistry`; `GET /health/circuit-breakers` |
| `@backendkit-labs/bulkhead` | `ShippingService` — `@WithBulkhead` limits concurrent outbound shipping calls to 8; `GET /health/bulkheads` |
| `@backendkit-labs/pipeline` | `OrdersModule` — 6-step `order-fulfillment` pipeline: validate → reserve inventory → charge payment → confirm inventory → create shipment → notify customer |
| `@backendkit-labs/http-client` | `HttpClientsModule` — two typed HTTP clients (`payment-gateway`, `shipping-provider`) with built-in retry and per-client circuit breaker |
| `@backendkit-labs/observability` | Every service — structured logging (`LoggerService`), metrics (`MetricsService`), correlation IDs, performance tracking (`@TrackPerformance`), global exception filter |
| `@backendkit-labs/result` | `ProductsService`, `InventoryService`, `PaymentsService`, `ShippingService` — `ok()`/`fail()` for typed error handling without exceptions |
| `@backendkit-labs/request-scanner` | `WebhooksController` — `SanitizePipe` on the webhook endpoint; `WafMiddleware` applied globally (excluding `/health` and `/sim`) |
| `@backendkit-labs/auto-learning` | Referenced in dependencies; ready for integration in adaptive threshold tuning scenarios |

---

## Stress Tests (k6)

All scripts live in `stress-tests/k6/scenarios/`. Run them while the server is running.

### 1. Full order flow

```bash
k6 run stress-tests/k6/scenarios/order-flow.k6.js
# With a custom base URL:
BASE_URL=http://localhost:3000 k6 run stress-tests/k6/scenarios/order-flow.k6.js
```

Ramps from 10 → 50 VUs over 2 minutes. Measures `order_pipeline_ms` (p95 target: <3 s) and `order_fail_rate` (target: <30%).

### 2. Circuit breaker trip

```bash
# Set high failure rate to force circuit trips
PAYMENT_FAILURE_RATE=0.9 npm run start:dev

# In another terminal:
k6 run stress-tests/k6/scenarios/circuit-breaker.k6.js
```

Ramps to 30 VUs. Watch `/health/circuit-breakers` output — the `payment-gateway` and `http:payment-gateway` circuits will transition `closed → open → half-open → closed` as the scenario progresses.

To trigger a trip manually:

```bash
# Set env var and hammer the orders endpoint
export PAYMENT_FAILURE_RATE=0.9
for i in {1..20}; do
  curl -s -X POST http://localhost:3000/orders \
    -H "Content-Type: application/json" \
    -d '{"customerId":"cust-seed-1","items":[{"productId":"prod-seed-1","variantId":"var-seed-1","quantity":1,"unitPrice":2999}],"paymentMethod":"card"}' &
done
wait
# Then check:
curl http://localhost:3000/health/circuit-breakers
```

### 3. WAF / request-scanner

```bash
k6 run stress-tests/k6/scenarios/waf.k6.js
```

Sends 50 iterations across 5 VUs — a mix of SQL injection, XSS, and path traversal payloads (expected: 403) alongside clean payloads (expected: 201). Validates the WAF middleware blocks attacks while passing legitimate requests.

---

## Architecture

```
AppModule
├── ObservabilityModule (global logger, metrics, correlation IDs)
├── CircuitBreakerModule (global circuit breaker registry)
├── BulkheadModule (global bulkhead registry)
├── WafModule (global WAF middleware, excludes /health and /sim)
├── PipelineModule (order-fulfillment pipeline, 6 steps)
├── HttpClientsModule (payment-gateway + shipping-provider clients)
├── SimulationModule (/sim/payment, /sim/shipping — fake external APIs)
├── ProductsModule
├── CustomersModule ←→ OrdersModule (forwardRef circular dep)
├── InventoryModule
├── PaymentsModule
├── ShippingModule
├── OrdersModule (owns the pipeline steps)
├── WebhooksModule
├── HealthModule
└── SeedModule (bootstraps in-memory data on startup)
```
