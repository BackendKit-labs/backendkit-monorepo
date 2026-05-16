---
title: Circuit Breaker
description: Sliding-window circuit breaker for Node.js with business vs infrastructure error classification and optional NestJS integration.
---

# @backendkit-labs/circuit-breaker

[![npm](https://img.shields.io/npm/v/@backendkit-labs/circuit-breaker?style=flat-square&color=cb3837)](https://www.npmjs.com/package/@backendkit-labs/circuit-breaker)
[![License](https://img.shields.io/npm/l/@backendkit-labs/circuit-breaker?style=flat-square)](https://github.com/BackendKit-labs/backendkit-monorepo/blob/master/LICENSE)
[![Node](https://img.shields.io/node/v/@backendkit-labs/circuit-breaker?style=flat-square)](https://nodejs.org)

> Circuit Breaker pattern for Node.js — fail-fast with automatic recovery.

Prevents cascading failures by stopping calls to a failing dependency and giving it time to recover. The key design decision: **not every error means the dependency is down**. HTTP 404, 401, and validation errors are business errors that pass through transparently without ever opening the circuit. Only infrastructure errors (network timeouts, HTTP 5xx, DB connection failures) count against the threshold.

## Installation

```bash
npm install @backendkit-labs/circuit-breaker
```

NestJS peer dependencies (only for the `/nestjs` subpath):

```bash
npm install @nestjs/common @nestjs/core rxjs
```

## Quick Start

```typescript
import { CircuitBreaker, isHttpServerError } from '@backendkit-labs/circuit-breaker';

const cb = new CircuitBreaker({
  name: 'payment-api',
  failureThreshold: 50,   // open when 50% of calls fail
  minimumCalls:     5,    // don't evaluate until 5 calls are in the window
  openTimeoutMs:    30_000,
  halfOpenMaxCalls: 3,
  isFailure: isHttpServerError, // HTTP 4xx = business errors, transparent
});

// Basic usage
const result = await cb.execute(() => callPaymentApi(orderId));

// With fallback for controlled exits
const result = await cb.execute(
  () => callPaymentApi(orderId),
  (err) => err instanceof CircuitBreakerOpenError
    ? cache.get(orderId)      // circuit open → serve from cache
    : { status: 'degraded' }, // infra error → safe default
);
```

## Core Concepts

### Business vs Infrastructure Errors

The fundamental distinction that separates this library from a simple retry counter:

| Error type | Examples | Circuit reaction |
|------------|----------|-----------------|
| **Infrastructure** | Network timeout, HTTP 500/503, DB connection refused | Counted against the failure threshold — can open the circuit |
| **Business** | HTTP 404, 401, 422 Validation | Transparent — circuit treats the call as successful |

:::info Why this matters
A surge of 404s doesn't mean your dependency is down. Counting them would open your circuit (and degrade your service) for completely normal, expected behavior.
:::

```typescript
const cb = new CircuitBreaker({
  name: 'inventory',
  isFailure: (error) => {
    if (error instanceof ProductNotFoundException) return false; // business
    if (error instanceof ValidationError)          return false; // business
    return true;                                                 // infrastructure
  },
});
```

### State Machine

```
                   failures ≥ threshold
  CLOSED ─────────────────────────────────────→ OPEN
    ↑                                              │
    │  halfOpenMaxCalls successes    openTimeoutMs │
    │ ←─────────────────────────── HALF_OPEN ←────┘
    │                                    │
    └──────── any infra failure ─────────┘ (re-opens)
```

| State | Behavior |
|-------|----------|
| `CLOSED` | Normal operation. Every call is recorded in the sliding window. |
| `OPEN` | Fail-fast. All calls throw `CircuitBreakerOpenError` immediately. |
| `HALF_OPEN` | Probe mode. Allows `halfOpenMaxCalls` test calls. All succeed → `CLOSED`. Any infra failure → `OPEN`. |

### Sliding Window

The circuit evaluates failure and slow-call rates over the last `slidingWindowSize` calls (count-based window). The circuit only opens when:

1. The window has at least `minimumCalls` recorded.
2. The failure rate ≥ `failureThreshold` **OR** the slow-call rate ≥ `slowCallThreshold`.

## CircuitBreaker API

### `execute(task, fallback?)`

```typescript
// Throws CircuitBreakerOpenError if OPEN, original error if infra failure
const data = await cb.execute(() => fetchUser(id));

// With fallback — no try/catch at call site
const data = await cb.execute(
  () => fetchFromApi(id),
  (err) => err instanceof CircuitBreakerOpenError
    ? cache.get(id)        // circuit open  → serve cache
    : defaultResponse(id), // infra failure → safe default
);
```

:::warning Fallback rule for business errors
Business errors **always** re-throw — the fallback is never called. They represent domain failures (404, validation) that callers must handle explicitly.
:::

### State & Metrics

```typescript
cb.getState();    // CircuitBreakerState.CLOSED | OPEN | HALF_OPEN
cb.canAttempt();  // boolean — can a call go through right now?

const m = cb.getMetrics();
// {
//   name:              'payment-api',
//   state:             'closed',
//   failureRate:       20,        // % in current sliding window
//   slowCallRate:      0,
//   bufferedCalls:     10,
//   totalCalls:        143,
//   successfulCalls:   114,
//   failedCalls:       29,
//   notPermittedCalls: 5,
// }

cb.reset(); // force-close and reset all counters
```

### `onStateChange` Hook

```typescript
const cb = new CircuitBreaker({
  name: 'payment-api',
  onStateChange: (from, to, metrics) => {
    logger.warn(`Circuit '${metrics.name}': ${from} → ${to}`, {
      failureRate: metrics.failureRate,
    });

    if (to === CircuitBreakerState.OPEN) {
      alerting.trigger('circuit-open', { name: metrics.name });
    }
    if (to === CircuitBreakerState.CLOSED) {
      alerting.resolve('circuit-open', metrics.name);
    }
  },
});
```

### Configuration Reference

```typescript
const cb = new CircuitBreaker({
  name: 'my-dependency',           // required

  failureThreshold:  50,   // % of calls that must fail to open — default: 50
  slowCallThreshold: 100,  // % of slow calls to open — default: 100 (disabled)
  slowCallDurationMs: 5_000, // ms above which a call is slow — default: 60_000
  minimumCalls:      5,    // min calls before evaluation — default: 5
  slidingWindowSize: 10,   // count-based sliding window — default: 10
  halfOpenMaxCalls:  3,    // probes before closing — default: 3
  openTimeoutMs:     30_000, // wait in OPEN — default: 60_000

  isFailure: isHttpServerError, // error classifier — default: () => true
  onStateChange: (from, to, metrics) => { ... },
});
```

## CircuitBreakerRegistry

Manages named instances. Calling `getOrCreate` with the same name always returns the same instance.

```typescript
const registry = new CircuitBreakerRegistry();
const cb = registry.getOrCreate({
  name:             'stripe-api',
  failureThreshold: 40,
  isFailure:        isHttpServerError,
});
```

### Factory Methods

Pre-configured instances for common resource types:

```typescript
registry.getForHttpExternal('stripe-api')  // HTTP 5xx only — 50% | 10 window | 30s
registry.getForService('inventory-service') // all errors   — 50% | 10 window | 30s
registry.getForDatabase('orders_schema')    // all errors   — 30% |  5 window | 15s
```

| Method | Threshold | Window | Min calls | Timeout | `isFailure` |
|--------|-----------|--------|-----------|---------|-------------|
| `getForHttpExternal(name)` | 50% | 10 | 5 | 30s | `isHttpServerError` |
| `getForService(name)` | 50% | 10 | 5 | 30s | all errors |
| `getForDatabase(schema)` | 30% | 5 | 3 | 15s | all errors |

### Registry API

```typescript
registry.getAllMetrics();   // Record<string, CircuitBreakerMetrics>
registry.getOpenBreakers(); // CircuitBreakerMetrics[] — OPEN and HALF_OPEN only
registry.reset('name');     // force-close + clear a specific breaker
registry.resetAll();        // reset all breakers
```

## `isHttpServerError`

Built-in classifier — HTTP client errors are business, server errors are infrastructure.

```typescript
isHttpServerError(new Error('ECONNREFUSED'))  // → true  (network error)
isHttpServerError({ getStatus: () => 500 })   // → true  (server error)
isHttpServerError({ getStatus: () => 404 })   // → false (not found — business)
isHttpServerError({ getStatus: () => 401 })   // → false (unauthorized — business)
```

Works with NestJS `HttpException` and any object implementing `getStatus(): number`.

## NestJS Integration

```typescript
import { CircuitBreakerModule } from '@backendkit-labs/circuit-breaker/nestjs';

@Module({ imports: [CircuitBreakerModule] })
export class AppModule {}
```

`CircuitBreakerModule` provides and exports: `CircuitBreakerRegistry`, `CircuitBreakerService`, `CircuitBreakerGuard`, `CircuitBreakerInterceptor`.

### Guard — per-route protection

```typescript
@Controller('payments')
export class PaymentsController {
  @Post()
  @UseCircuitBreaker({ name: 'stripe-api', failureThreshold: 40 })
  @UseGuards(CircuitBreakerGuard)
  charge(@Body() dto: ChargeDto) {
    return this.paymentsService.charge(dto);
  }
}
```

Returns `503 Service Unavailable` when the circuit is `OPEN`.

### Interceptor — auto-wrap every handler

```typescript
// Global — circuit named 'handler:ClassName.methodName' for each route
app.useGlobalInterceptors(app.get(CircuitBreakerInterceptor));
```

### Method Decorator

```typescript
@Injectable()
export class PaymentService {
  constructor(public readonly circuitBreakerRegistry: CircuitBreakerRegistry) {}

  @WithCircuitBreaker({
    name:             'stripe',
    failureThreshold: 40,
    fallback: (err) => err instanceof CircuitBreakerOpenError
      ? { status: 'queued' }
      : { status: 'error' },
  })
  async charge(dto: ChargeDto) {
    return this.stripeClient.charge(dto);
  }
}
```

### `CircuitBreakerService` — monitoring

```typescript
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

Automatically logs a warning every 60 seconds for any `OPEN` breakers. No configuration needed.

## Architecture

```
@backendkit-labs/circuit-breaker          (core — zero framework dependencies)
  CircuitBreaker                          3-state machine + count-based sliding window
  CircuitBreakerRegistry                  named instances, factory methods, bulk ops
  isHttpServerError                       built-in HTTP error classifier

@backendkit-labs/circuit-breaker/nestjs  (optional NestJS layer)
  CircuitBreakerModule                   NestJS module — registers all providers
  CircuitBreakerGuard                    @UseCircuitBreaker() per-route guard
  CircuitBreakerInterceptor              auto-wraps every handler
  WithCircuitBreaker                     method-level decorator
  CircuitBreakerService                  metrics access + automatic background monitoring
```
