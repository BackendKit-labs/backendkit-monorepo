# Shopify Backend — BackendKit Labs Showcase

A production-grade NestJS Shopify-like backend that demonstrates every library in the BackendKit Labs suite. External calls (payment gateway, shipping provider) are simulated by an internal `SimulationModule` controller mounted at `/sim/*`, so no real external dependencies are required.

---

## Prerequisites

- **Node.js 20+** (LTS recommended)
- **k6** (for stress tests) — https://k6.io/docs/get-started/installation/

> **Monorepo required.** Three packages (`again`, `idempotency`, `request-scanner`) are resolved via `file:` paths from the monorepo root. You must clone the full monorepo and build those packages before installing this example.

---

## Installation

```bash
# 1. Clone the monorepo (if you haven't already)
git clone https://github.com/BackendKit-labs/backendkit-monorepo.git
cd backendkit-monorepo

# 2. Build the local packages this example depends on
npm run build --workspace=packages/again
npm run build --workspace=packages/idempotency
npm run build --workspace=packages/request-scanner

# 3. Install shopify-backend dependencies
cd examples/shopify-backend
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

The server starts on `http://localhost:3003` by default.

On startup, `SeedService` automatically populates the in-memory store with 5 products, 5 inventory entries (100 units each), and 3 customers — all with deterministic IDs (`prod-seed-1` … `prod-seed-5`, `cust-seed-1` … `cust-seed-3`).

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Overall health + circuit breaker / bulkhead summaries |
| `GET` | `/health/circuit-breakers` | All circuit breaker metrics |
| `GET` | `/health/bulkheads` | All bulkhead metrics |
| `GET` | `/health/auto-learning` | Auto-learning loop state and current tuned config |
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
| `PATCH` | `/sim/config` | Update simulator failure rates and delays at runtime (used by k6 scripts) |

### Quick order example

```bash
curl -X POST http://localhost:3003/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: my-unique-key-001" \
  -d '{
    "customerId": "cust-seed-1",
    "items": [{"productId": "prod-seed-1", "variantId": "var-seed-1", "quantity": 1, "unitPrice": 2999}],
    "paymentMethod": "card"
  }'
```

> `POST /orders` requires an `Idempotency-Key` header. Any unique string up to 256 characters works.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3003` | HTTP port to listen on |
| `NODE_ENV` | `development` | Environment label used in logs |
| `LOG_LEVEL` | `info` | Log level: `debug`, `info`, `warn`, `error` |
| `PAYMENT_FAILURE_RATE` | `0.2` | Probability (0–1) that the payment simulator returns 500 |
| `PAYMENT_DELAY_MS` | `150` | Base latency (ms) added to every payment simulator call |
| `SHIPPING_FAILURE_RATE` | `0.15` | Probability (0–1) that the shipping simulator returns 500 |
| `SHIPPING_DELAY_MS` | `250` | Base latency (ms) added to every shipping simulator call |
| `EMAIL_FAILURE_RATE` | `0.05` | Probability (0–1) that the notification step silently fails (order still succeeds) |

> Failure rates and delays can also be changed **at runtime** (without restarting) via `PATCH /sim/config` — all k6 scripts use this endpoint to switch between traffic phases.

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
| `@backendkit-labs/auto-learning` | `AutoLearningModule.forRoot()` (global, 30 s feedback loop) — `@AutoLearn()` on `POST /orders`, `POST /products`, `POST /customers`; adapters auto-tune CB and bulkhead thresholds; `GET /health/auto-learning` exposes current tuned config |

---

## Stress Tests (k6)

All scripts live in `stress-tests/k6/scenarios/`. Start the server first, then run any script from the `examples/shopify-backend` directory.

```
stress-tests/k6/scenarios/
├── order-flow.k6.js          # Full pipeline under load
├── circuit-breaker.k6.js     # Circuit breaker trip and recovery
├── idempotency.k6.js         # Idempotency key enforcement
├── again-idempotency.k6.js   # Retry + idempotency lifecycle
├── auto-learning.k6.js       # Adaptive config tuning over 3 phases
└── waf.k6.js                 # WAF / request-scanner attack blocking
```

All scripts default to `http://localhost:3003`. Override with `BASE_URL`:

```bash
BASE_URL=http://localhost:3003 k6 run stress-tests/k6/scenarios/<script>.k6.js
```

---

### 1. Full order flow — `order-flow.k6.js`

**Library under test:** `@backendkit-labs/pipeline`, `@backendkit-labs/circuit-breaker`, full stack

**Duration:** ~2 min | **Max VUs:** 50

```bash
k6 run stress-tests/k6/scenarios/order-flow.k6.js
```

Ramps 0 → 10 → 50 → 0 VUs. Every iteration runs `POST /orders` with a unique idempotency key and verifies the response contains a `transactionId`.

**What to observe:**
- `order_pipeline_ms` (p95): target < 3 s — measures end-to-end pipeline latency under concurrency
- `order_fail_rate`: target < 30% — with the default 20% payment failure rate, `again` retries compensate for most failures

---

### 2. Circuit breaker trip — `circuit-breaker.k6.js`

**Library under test:** `@backendkit-labs/circuit-breaker`

```bash
k6 run stress-tests/k6/scenarios/circuit-breaker.k6.js
```

The script ramps to 30 VUs with an elevated payment failure rate to force circuit trips. Watch the circuit state evolve in real time:

```bash
# In a separate terminal while the test is running:
watch -n 2 'curl -s http://localhost:3003/health/circuit-breakers | jq .'
```

Expected transitions: `closed → open → half-open → closed` on the `payment-gateway` and `http:payment-gateway` circuits.

To trigger a manual trip without k6:

```bash
for i in $(seq 1 20); do
  curl -s -X POST http://localhost:3003/orders \
    -H "Content-Type: application/json" \
    -H "Idempotency-Key: manual-trip-$i" \
    -d '{"customerId":"cust-seed-1","items":[{"productId":"prod-seed-1","variantId":"var-seed-1","quantity":1,"unitPrice":2999}],"paymentMethod":"card"}' &
done
wait
curl http://localhost:3003/health/circuit-breakers
```

> To increase the failure rate without restarting the server:
> ```bash
> curl -X PATCH http://localhost:3003/sim/config \
>   -H "Content-Type: application/json" \
>   -d '{"paymentFailureRate": 0.9}'
> ```

---

### 3. Idempotency — `idempotency.k6.js`

**Library under test:** `@backendkit-labs/idempotency`

**Duration:** ~60 s | **Scenarios:** 4 parallel

```bash
k6 run stress-tests/k6/scenarios/idempotency.k6.js
```

Runs four scenarios simultaneously:

| Scenario | What it tests |
|----------|--------------|
| `normal` | Unique key per request → always executes the handler, always 201 |
| `replay` | Same key sent twice → second response has `Idempotent-Replayed: true` |
| `missing_key` | No `Idempotency-Key` header → 422 |
| `invalid_key` | Key > 256 chars → 422 |

**Key thresholds:**
- `idempotency_fail_rate` < 5% — normal orders must succeed
- `idempotency_replay_rate` > 0 — replays must be detected
- `http_req_duration` p95 < 3 s

**What to observe:**
- Replay responses are instant (no handler execution, no payment call) — `Idempotent-Replayed: true` header present
- The `missing_key` and `invalid_key` scenarios confirm the middleware rejects bad requests before they reach the business logic

---

### 4. Retry + Idempotency lifecycle — `again-idempotency.k6.js`

**Library under test:** `@backendkit-labs/again` + `@backendkit-labs/idempotency`

**Duration:** ~75 s | **Scenarios:** 3 (sequential + parallel)

```bash
k6 run stress-tests/k6/scenarios/again-idempotency.k6.js
```

The most revealing test — combines retry resilience with idempotency key lifecycle:

| Scenario | What it proves |
|----------|---------------|
| `retry_resilience` | `again` retries up to 3× with exponential backoff. Gateway fails 60% → P(all 3 fail) = 21.6% → > 65% of orders succeed |
| `idempotency_replay` | Same key sent twice. Second request returns cached response instantly (`Idempotent-Replayed: true`), never hits the payment gateway |
| `lifecycle` | Full delete-on-failure cycle: (1) force 100% failure → key deleted → (2) same key + 0% failure → handler runs again → (3) same key again → replayed |

**Key thresholds:**
- `again_retry_success_rate` > 65%
- `again_idempotency_replay_rate` > 85%
- `http_req_duration` p95 < 8 s (includes retry delays)

**What to observe in the summary:**
```
[retry_resilience]  Órdenes exitosas:  78.3%  (gateway falla 60%)
[idempotency_replay] Replay rate:      100.0%
[lifecycle]          Ciclos OK:         4/4
```

The lifecycle scenario (runs after 65 s) demonstrates that a failed handler never leaves a "stuck" idempotency key — the client can safely retry with the same key.

---

### 5. Auto-learning — `auto-learning.k6.js`

**Library under test:** `@backendkit-labs/auto-learning`

**Duration:** ~160 s | **Scenarios:** 3 traffic phases + observer

```bash
k6 run stress-tests/k6/scenarios/auto-learning.k6.js
```

Drives the auto-learning feedback loop through three phases:

| Phase | Time | VUs | Config |
|-------|------|-----|--------|
| Baseline | 0 – 50 s | 5 | paymentFailureRate=5%, delay=100ms |
| Stress | 50 – 110 s | 25 | paymentFailureRate=85%, delay=1000ms |
| Recovery | 110 – 160 s | 5 | paymentFailureRate=2%, delay=80ms |

A dedicated **observer** VU polls `GET /health/auto-learning` every 5 s and logs the tuned config snapshot at each cycle.

**What to observe in the terminal during the test:**

```
[auto-learning] running=true | timeoutMs=3000  | maxRetries=2 | cbFailureThreshold=50 | bulkhead.maxConcurrent=8
[auto-learning] running=true | timeoutMs=4829  | maxRetries=3 | cbFailureThreshold=45 | bulkhead.maxConcurrent=6
```

**Expected config evolution** (auto-learning adapts to stress):
- `timeoutMs` ↑ — allows more time when the gateway is slow
- `maxRetries` ↑ — retries more aggressively when errors are high
- `failureThreshold` ↓ — circuit breaker trips faster to fail-fast
- After recovery, values trend back toward defaults

**Custom metrics** recorded in the k6 summary:
- `al_timeout_ms` — trend of observed timeoutMs across the test
- `al_max_retries` / `al_failure_threshold` / `al_bulkhead_max_concurrent` — gauge snapshots

---

### 6. WAF / request-scanner — `waf.k6.js`

**Library under test:** `@backendkit-labs/request-scanner`

**Duration:** ~30 s | **50 iterations across 5 VUs**

```bash
k6 run stress-tests/k6/scenarios/waf.k6.js
```

Sends a mix of attack payloads and clean requests to `POST /webhooks/shopify`:

| Payload type | Expected response |
|---|---|
| SQL injection (`' OR 1=1 --`) | 403 Forbidden |
| XSS (`<script>alert(1)</script>`) | 403 Forbidden |
| Path traversal (`../../etc/passwd`) | 403 Forbidden |
| Clean webhook payload | 201 Created |

**What to observe:**
- All attack payloads blocked at the WAF layer, before reaching any service code
- Clean payloads pass through normally — the WAF adds no false positives
- `checks` pass rate should be 100%

---

## Architecture

```
AppModule
├── ObservabilityModule (global logger, metrics, correlation IDs)
├── CircuitBreakerModule (global circuit breaker registry)
├── BulkheadModule (global bulkhead registry)
├── AutoLearningModule (global — 30 s feedback loop, tunes CB + bulkhead; @AutoLearn on POST routes)
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
