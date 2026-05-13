# @backendkit-labs/circuit-breaker

[![npm version](https://img.shields.io/npm/v/@backendkit-labs/circuit-breaker?style=flat-square&color=cb3837)](https://www.npmjs.com/package/@backendkit-labs/circuit-breaker)
[![CI](https://img.shields.io/github/actions/workflow/status/backendkit-dev/backendkit-monorepo/ci.yml?style=flat-square&label=CI)](https://github.com/backendkit-dev/backendkit-monorepo/actions/workflows/ci.yml)
[![License](https://img.shields.io/npm/l/@backendkit-labs/circuit-breaker?style=flat-square)](LICENSE)
[![Node](https://img.shields.io/node/v/@backendkit-labs/circuit-breaker?style=flat-square)](package.json)

> Circuit Breaker pattern for Node.js — fail-fast with automatic recovery. Distinguishes infrastructure errors from business errors. Optional NestJS integration.

Prevents cascading failures by stopping calls to a failing dependency and allowing it time to recover. Business errors (HTTP 4xx, validation failures) pass through transparently without affecting the circuit state.

---

## Installation

```bash
npm install @backendkit-labs/circuit-breaker
```

---

## Quick Start

```typescript
import { CircuitBreaker, isHttpServerError } from '@backendkit-labs/circuit-breaker';

const cb = new CircuitBreaker({
  name: 'payment-api',
  failureThreshold:  50,   // open when 50% of calls fail
  minimumCalls:       5,   // evaluate only after 5 calls
  openTimeoutMs:  30_000,  // wait 30s before probing (HALF_OPEN)
  halfOpenMaxCalls:   3,   // 3 successful probes to close again

  // Only HTTP 5xx and network errors open the circuit.
  // HTTP 4xx (404, 401, 422…) are business errors — transparent.
  isFailure: isHttpServerError,
});

const result = await cb.execute(() => callPaymentApi(orderId));
```

---

## Business vs Infrastructure Errors

This is the key design decision. Not all errors mean the dependency is down:

| Error | Example | Circuit reaction |
|-------|---------|-----------------|
| **Infrastructure** | network timeout, 500, 503, DB connection refused | Counts toward failure threshold — can open circuit |
| **Business** | 404 Not Found, 401 Unauthorized, 422 Validation | Transparent — circuit treats the call as successful |

```typescript
import { CircuitBreaker } from '@backendkit-labs/circuit-breaker';

const cb = new CircuitBreaker({
  name: 'inventory',
  isFailure: (error) => {
    // Custom classification
    if (error instanceof ProductNotFoundException) return false; // business
    if (error instanceof ValidationError)          return false; // business
    return true;                                                 // infrastructure
  },
});
```

### Built-in helper — `isHttpServerError`

Works with NestJS `HttpException` and any object with a `getStatus(): number` method:

```typescript
import { isHttpServerError } from '@backendkit-labs/circuit-breaker';

isHttpServerError({ getStatus: () => 500 }) // → true  (infra)
isHttpServerError({ getStatus: () => 503 }) // → true  (infra)
isHttpServerError({ getStatus: () => 404 }) // → false (business)
isHttpServerError({ getStatus: () => 401 }) // → false (business)
isHttpServerError(new Error('ECONNREFUSED')) // → true  (infra)
```

---

## State Machine

```
         failures ≥ threshold          probe succeeds (halfOpenMaxCalls)
CLOSED ─────────────────────→ OPEN ──────────────────────────────────→ CLOSED
  ↑                             │                                         │
  │       openTimeoutMs         ↓          any infrastructure failure     │
  └──────────────────── HALF_OPEN ←────────────────────────────────────  │
                                                                          ↑
```

| State | Behavior |
|-------|----------|
| `CLOSED` | Normal operation. Counts failures in a sliding window. |
| `OPEN` | Fail-fast. All calls throw `CircuitBreakerOpenError` immediately. |
| `HALF_OPEN` | Allows `halfOpenMaxCalls` test calls through. Success → CLOSED, failure → OPEN. |

---

## Core API

### `CircuitBreaker`

```typescript
// Execute a task — throws CircuitBreakerOpenError if circuit is OPEN
await cb.execute(async () => { ... });

// Execute with a fallback for controlled exits
const data = await cb.execute(
  () => fetchFromApi(id),
  (err) => err instanceof CircuitBreakerOpenError
    ? cache.get(id)        // circuit open  → serve cache
    : defaultResponse(id), // infra failure → safe default
);

// Check if calls are currently allowed
if (cb.canAttempt()) { ... }

// Current state
cb.getState(); // 'closed' | 'open' | 'half_open'

// Metrics snapshot
cb.getMetrics();

// Force-close the circuit and reset all counters
cb.reset();
```

### Fallback behavior

| Scenario | Without fallback | With fallback |
|----------|-----------------|---------------|
| Circuit OPEN | throws `CircuitBreakerOpenError` | calls `fallback(CircuitBreakerOpenError)` |
| Infrastructure error | throws original error | calls `fallback(originalError)` |
| Business error | always re-thrown | always re-thrown (fallback is **not** called) |

Business errors bypass the fallback intentionally — they represent domain failures (404, 401, validation) that callers should handle explicitly, not swallow with a generic fallback.

### `CircuitBreakerConfig`

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `name` | `string` | required | Identifier for metrics |
| `failureThreshold` | `number` | `50` | % of failures to open circuit |
| `slowCallThreshold` | `number` | `100` | % of slow calls to open circuit |
| `slowCallDurationMs` | `number` | `60000` | What counts as a slow call (ms) |
| `minimumCalls` | `number` | `5` | Min calls before thresholds are evaluated |
| `slidingWindowSize` | `number` | `10` | Number of calls in the window |
| `halfOpenMaxCalls` | `number` | `3` | Test calls allowed in HALF_OPEN |
| `openTimeoutMs` | `number` | `60000` | Wait in OPEN before probing (ms) |
| `isFailure` | `(error) => boolean` | `() => true` | Error classifier |
| `onStateChange` | `(from, to, metrics) => void` | `undefined` | Hook fired on every state transition |

### `CircuitBreakerMetrics`

```typescript
{
  name:              string;
  state:             'closed' | 'open' | 'half_open';
  failureRate:       number;   // % in current window
  slowCallRate:      number;   // % in current window
  bufferedCalls:     number;   // calls in sliding window
  totalCalls:        number;
  successfulCalls:   number;
  failedCalls:       number;
  slowCalls:         number;
  notPermittedCalls: number;   // rejected while OPEN
}
```

### Errors

```typescript
import { CircuitBreakerOpenError } from '@backendkit-labs/circuit-breaker';

try {
  await cb.execute(task);
} catch (error) {
  if (error instanceof CircuitBreakerOpenError) {
    // Circuit is OPEN — dependency is down, fail fast
  }
}
```

---

### Observability — `onStateChange`

React proactively to every state transition without polling:

```typescript
const cb = new CircuitBreaker({
  name: 'payment-api',
  onStateChange: (from, to, metrics) => {
    logger.warn(`Circuit ${metrics.name}: ${from} → ${to}`, {
      failureRate: metrics.failureRate,
      failedCalls: metrics.failedCalls,
    });

    if (to === CircuitBreakerState.OPEN) {
      alerting.trigger('circuit-open', metrics);
    }
  },
});
```

The callback receives a full `CircuitBreakerMetrics` snapshot taken at the exact moment of transition, so `failureRate`, counters, and `state` are already updated.

---

## CircuitBreakerRegistry

Manages named instances with pre-configured defaults for common resource types:

```typescript
import { CircuitBreakerRegistry } from '@backendkit-labs/circuit-breaker';

const registry = new CircuitBreakerRegistry();

// External HTTP — only 5xx opens the circuit, 4xx pass through
const http = registry.getForHttpExternal('stripe-api');

// Internal service calls — all errors count, 50% threshold
const svc  = registry.getForService('inventory-service');

// Database — all errors count, 30% threshold, faster recovery (15s)
const db   = registry.getForDatabase('orders_schema');

// Custom
const custom = registry.getOrCreate({
  name: 'my-dep',
  failureThreshold: 40,
  isFailure: isHttpServerError,
});

// Observability
registry.getAllMetrics();    // all breakers
registry.getOpenBreakers(); // only OPEN or HALF_OPEN
registry.reset('stripe-api');
registry.resetAll();
```

| Method | Threshold | Window | Open timeout | `isFailure` |
|--------|-----------|--------|-------------|-------------|
| `getForHttpExternal(name)` | 50% | 10 | 30s | `isHttpServerError` |
| `getForService(name)` | 50% | 10 | 30s | all errors |
| `getForDatabase(schema)` | 30% | 5 | 15s | all errors |

---

## NestJS Integration

```typescript
import { CircuitBreakerModule } from '@backendkit-labs/circuit-breaker/nestjs';

@Module({ imports: [CircuitBreakerModule] })
export class AppModule {}
```

### Guard — declarative per-route protection

```typescript
import { UseCircuitBreaker, CircuitBreakerGuard } from '@backendkit-labs/circuit-breaker/nestjs';

@Controller('payments')
export class PaymentsController {
  @UseCircuitBreaker({ name: 'stripe-api', failureThreshold: 40 })
  @UseGuards(CircuitBreakerGuard)
  @Post()
  charge(@Body() dto: ChargeDto) { ... }
}
```

Returns `503 Service Unavailable` when the circuit is OPEN.

The default `isFailure` in all NestJS integration points is `isHttpServerError` — HTTP 4xx errors are business errors and never open the circuit.

### Interceptor — wraps every handler automatically

```typescript
import { CircuitBreakerInterceptor } from '@backendkit-labs/circuit-breaker/nestjs';

// Global — one breaker per controller method, named handler:ClassName.methodName
app.useGlobalInterceptors(app.get(CircuitBreakerInterceptor));

// Or per controller
@UseInterceptors(CircuitBreakerInterceptor)
@Controller('reports')
export class ReportsController { ... }
```

### Method Decorator

```typescript
import { WithCircuitBreaker } from '@backendkit-labs/circuit-breaker/nestjs';

@Injectable()
export class PaymentService {
  constructor(
    public readonly circuitBreakerRegistry: CircuitBreakerRegistry,
  ) {}

  @WithCircuitBreaker({
    name: 'stripe',
    failureThreshold: 40,
    fallback: (err) => err instanceof CircuitBreakerOpenError
      ? { status: 'unavailable' }
      : { status: 'error' },
  })
  async charge(dto: ChargeDto) {
    return this.stripeClient.charge(dto);
  }
}
```

### Monitoring — CircuitBreakerService

```typescript
import { CircuitBreakerService } from '@backendkit-labs/circuit-breaker/nestjs';

@Controller('health')
export class HealthController {
  constructor(private readonly cb: CircuitBreakerService) {}

  @Get('circuit-breakers')
  status() {
    return {
      all:  this.cb.getAllMetrics(),
      open: this.cb.getOpenBreakers(),
    };
  }
}
```

`CircuitBreakerService` logs a warning every 60 seconds listing any OPEN breakers and their failure rates.

---

## Architecture

```
@backendkit-labs/circuit-breaker         (core — no framework deps)
  CircuitBreaker                         3-state machine + sliding window
  CircuitBreakerRegistry                 named instances + factory methods
  isHttpServerError                      built-in error classifier

@backendkit-labs/circuit-breaker/nestjs  (optional NestJS layer)
  CircuitBreakerModule                   NestJS module
  CircuitBreakerGuard                    @UseCircuitBreaker() per-route
  CircuitBreakerInterceptor              auto-wraps every handler
  WithCircuitBreaker                     method-level decorator
  CircuitBreakerService                  metrics + auto-monitoring
```

---

## License

MIT — [BackendKit Labs](https://github.com/backendkit-dev)
