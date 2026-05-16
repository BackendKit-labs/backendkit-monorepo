# @backendkit-labs/circuit-breaker

[![npm version](https://img.shields.io/npm/v/@backendkit-labs/circuit-breaker?style=flat-square&color=cb3837)](https://www.npmjs.com/package/@backendkit-labs/circuit-breaker)
[![CI](https://img.shields.io/github/actions/workflow/status/BackendKit-labs/backendkit-monorepo/ci.yml?style=flat-square&label=CI)](https://github.com/BackendKit-labs/backendkit-monorepo/actions/workflows/ci.yml)
[![License](https://img.shields.io/npm/l/@backendkit-labs/circuit-breaker?style=flat-square)](LICENSE)
[![Node](https://img.shields.io/node/v/@backendkit-labs/circuit-breaker?style=flat-square)](package.json)
[![Docs](https://img.shields.io/badge/docs-backendkitlabs.dev-4f7eff?style=flat-square)](https://backendkitlabs.dev/docs/circuit-breaker/)

> Circuit Breaker pattern for Node.js — fail-fast with automatic recovery.

Prevents cascading failures by stopping calls to a failing dependency and giving it time to recover. The key design decision: **not every error means the dependency is down**. HTTP 404, 401, and validation errors are business errors that pass through transparently without ever opening the circuit. Only infrastructure errors (network timeouts, HTTP 5xx, DB connection failures) count against the threshold.

Optional NestJS integration included — guard, interceptor, method decorator, and automatic monitoring.

---

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
  - [Business vs Infrastructure Errors](#business-vs-infrastructure-errors)
  - [State Machine](#state-machine)
  - [Sliding Window](#sliding-window)
- [CircuitBreaker API](#circuitbreaker-api)
  - [execute()](#execute)
  - [Fallback](#fallback)
  - [State & Metrics](#state--metrics)
  - [onStateChange Hook](#onstatechange-hook)
  - [Configuration Reference](#configuration-reference)
- [CircuitBreakerRegistry](#circuitbreakerregistry)
  - [Factory Methods](#factory-methods)
  - [Registry API](#registry-api)
- [isHttpServerError](#ishttpservererror)
- [NestJS Integration](#nestjs-integration)
  - [Module Setup](#module-setup)
  - [Guard — per-route protection](#guard--per-route-protection)
  - [Interceptor — auto-wrap every handler](#interceptor--auto-wrap-every-handler)
  - [Method Decorator](#method-decorator)
  - [CircuitBreakerService — monitoring](#circuitbreakerservice--monitoring)
- [Architecture](#architecture)

---

## Installation

```bash
npm install @backendkit-labs/circuit-breaker
```

NestJS peer dependencies (only needed for the `/nestjs` subpath):

```bash
npm install @nestjs/common @nestjs/core rxjs
```

---

## TypeScript Configuration

### Subpath exports (`/nestjs`)

This package uses the `exports` field in `package.json` to expose the `/nestjs` subpath. TypeScript's ability to resolve it depends on the `moduleResolution` setting in your `tsconfig.json`.

**Modern resolution (recommended) — no extra config needed:**

```json
{
  "compilerOptions": {
    "moduleResolution": "bundler"
  }
}
```

`"bundler"`, `"node16"`, and `"nodenext"` all understand the `exports` field natively. This is the recommended setting for any project using a bundler or NestJS on TypeScript ≥ 5.

**Legacy resolution (`"node"`) — add a `paths` alias:**

NestJS projects generated before ~2024 default to `"moduleResolution": "node"`, which ignores the `exports` field. Add an explicit alias so TypeScript can find the types:

```json
{
  "compilerOptions": {
    "moduleResolution": "node",
    "paths": {
      "@backendkit-labs/circuit-breaker/nestjs": [
        "./node_modules/@backendkit-labs/circuit-breaker/dist/nestjs/index"
      ]
    }
  }
}
```

> **Why?** The `"node"` resolver was designed before subpath exports existed and only reads `main`/`types` at the package root — it ignores the `exports` map entirely. The `paths` alias manually points TypeScript to the correct `.d.ts` file.

### NestJS decorator support

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

And import `reflect-metadata` once at application startup:

```typescript
// main.ts
import 'reflect-metadata';
```

> NestJS CLI scaffolds these automatically. You only need to verify them if setting up a project manually.

---

## Quick Start

```typescript
import { CircuitBreaker, isHttpServerError } from '@backendkit-labs/circuit-breaker';

const cb = new CircuitBreaker({
  name: 'payment-api',
  failureThreshold:  50,   // open when 50% of calls fail
  minimumCalls:       5,   // don't evaluate until 5 calls are in the window
  openTimeoutMs:  30_000,  // wait 30s before probing (→ HALF_OPEN)
  halfOpenMaxCalls:   3,   // 3 successful probes to close again
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

---

## Core Concepts

### Business vs Infrastructure Errors

The fundamental distinction that separates this library from a simple retry counter:

| Error type | Examples | Circuit reaction |
|------------|----------|-----------------|
| **Infrastructure** | Network timeout, HTTP 500/503, DB connection refused | Counted against the failure threshold — can open the circuit |
| **Business** | HTTP 404 Not Found, 401 Unauthorized, 422 Validation | Transparent — circuit treats the call as successful |

This matters because a surge of 404s doesn't mean your dependency is down. Protecting against it would cause your circuit to open (and your service to degrade) for completely normal, expected behavior.

```typescript
import { CircuitBreaker } from '@backendkit-labs/circuit-breaker';

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
| `CLOSED` | Normal operation. Every call is recorded in the sliding window. Thresholds are evaluated after `minimumCalls`. |
| `OPEN` | Fail-fast. All calls throw `CircuitBreakerOpenError` immediately — no calls reach the dependency. |
| `HALF_OPEN` | Probe mode. Allows up to `halfOpenMaxCalls` test calls through. All succeed → `CLOSED`. Any infra failure → `OPEN`. |

### Sliding Window

The circuit evaluates failure and slow-call rates over the last `slidingWindowSize` calls (count-based window). Older calls are evicted as new ones come in. The circuit only opens when both conditions are met:

1. The window has at least `minimumCalls` recorded.
2. The failure rate ≥ `failureThreshold` **OR** the slow-call rate ≥ `slowCallThreshold`.

---

## CircuitBreaker API

### `execute()`

Executes a task inside the circuit breaker. Throws `CircuitBreakerOpenError` if the circuit is `OPEN`.

```typescript
// Simplest form — throws on error or open circuit
const data = await cb.execute(() => fetchUser(id));

// With async task
const data = await cb.execute(async () => {
  const response = await fetch(url);
  return response.json();
});
```

### Fallback

An optional second argument provides controlled exits without try/catch at the call site.

```typescript
const data = await cb.execute(
  () => fetchFromApi(id),
  (err) => err instanceof CircuitBreakerOpenError
    ? cache.get(id)        // circuit open  → serve cache
    : defaultResponse(id), // infra failure → safe default
);
```

**Fallback rules:**

| Scenario | Without fallback | With fallback |
|----------|-----------------|---------------|
| Circuit `OPEN` | throws `CircuitBreakerOpenError` | calls `fallback(CircuitBreakerOpenError)` |
| Infrastructure error | throws original error | calls `fallback(originalError)` |
| Business error | **always re-thrown** | **always re-thrown** — fallback is never called |

Business errors bypass the fallback intentionally. They represent domain failures (404, validation) that callers must handle explicitly, not silently swallow.

```typescript
// Async fallback is supported
const data = await cb.execute(
  () => primaryDb.query(sql),
  async () => replicaDb.query(sql), // fallback to read replica
);
```

### State & Metrics

```typescript
// Current state
cb.getState(); // CircuitBreakerState.CLOSED | OPEN | HALF_OPEN

// Can a call go through right now?
cb.canAttempt(); // boolean

// Full metrics snapshot
const m = cb.getMetrics();
// {
//   name:              'payment-api',
//   state:             'closed',
//   failureRate:       20,        // % in current sliding window
//   slowCallRate:      0,         // % of slow calls in window
//   bufferedCalls:     10,        // calls currently in the window
//   totalCalls:        143,       // lifetime total
//   successfulCalls:   114,
//   failedCalls:       29,
//   slowCalls:         0,
//   notPermittedCalls: 5,         // rejected while circuit was OPEN
// }

// Force-close and reset all counters (useful in tests or after manual intervention)
cb.reset();
```

### `onStateChange` Hook

Fires on every state transition. Receive a full metrics snapshot at the exact moment of change — no extra `getMetrics()` call needed.

```typescript
import { CircuitBreaker, CircuitBreakerState } from '@backendkit-labs/circuit-breaker';

const cb = new CircuitBreaker({
  name: 'payment-api',
  onStateChange: (from, to, metrics) => {
    logger.warn(`Circuit '${metrics.name}': ${from} → ${to}`, {
      failureRate:  metrics.failureRate,
      failedCalls:  metrics.failedCalls,
      totalCalls:   metrics.totalCalls,
    });

    if (to === CircuitBreakerState.OPEN) {
      alerting.trigger('circuit-open', {
        name:        metrics.name,
        failureRate: metrics.failureRate,
      });
    }

    if (to === CircuitBreakerState.CLOSED) {
      alerting.resolve('circuit-open', metrics.name);
    }
  },
});
```

Transitions that trigger the hook:

| Transition | When |
|------------|------|
| `CLOSED → OPEN` | Failure or slow-call rate exceeded the threshold |
| `OPEN → HALF_OPEN` | `openTimeoutMs` elapsed |
| `HALF_OPEN → CLOSED` | All probe calls succeeded |
| `HALF_OPEN → OPEN` | Any infrastructure failure during probing |

### Configuration Reference

```typescript
const cb = new CircuitBreaker({
  // Required
  name: 'my-dependency',

  // Failure threshold — % of calls that must fail to open the circuit
  // Default: 50
  failureThreshold: 50,

  // Slow-call threshold — % of calls that must be slow to open the circuit
  // Default: 100 (disabled — set lower to also protect against latency degradation)
  slowCallThreshold: 80,

  // Duration in ms above which a successful call is considered slow
  // Default: 60_000
  slowCallDurationMs: 5_000,

  // Minimum calls in the window before thresholds are evaluated
  // Default: 5
  minimumCalls: 5,

  // Size of the count-based sliding window
  // Default: 10
  slidingWindowSize: 10,

  // Number of successful probe calls required to close the circuit from HALF_OPEN
  // Default: 3
  halfOpenMaxCalls: 3,

  // Time in ms to wait in OPEN before transitioning to HALF_OPEN
  // Default: 60_000
  openTimeoutMs: 30_000,

  // Error classifier — return true for infrastructure errors, false for business errors
  // Default: () => true (all errors count)
  isFailure: isHttpServerError,

  // State transition hook — fires on every CLOSED↔OPEN↔HALF_OPEN change
  // Default: undefined
  onStateChange: (from, to, metrics) => {
    logger.warn(`${metrics.name}: ${from} → ${to}`);
  },
});
```

---

## CircuitBreakerRegistry

Manages named circuit breaker instances. Calling `getOrCreate` with the same name always returns the same instance.

```typescript
import { CircuitBreakerRegistry } from '@backendkit-labs/circuit-breaker';

const registry = new CircuitBreakerRegistry();

// Custom configuration
const cb = registry.getOrCreate({
  name:             'stripe-api',
  failureThreshold: 40,
  openTimeoutMs:    20_000,
  isFailure:        isHttpServerError,
  onStateChange:    (from, to, m) => logger.warn(`${m.name}: ${from} → ${to}`),
});

// Calling again with the same name returns the existing instance — config is ignored
const same = registry.getOrCreate({ name: 'stripe-api' }); // same === cb → true
```

### Factory Methods

Pre-configured instances for the most common resource types:

```typescript
// External HTTP services
// - Only HTTP 5xx and non-HTTP errors open the circuit (4xx pass through)
// - failureThreshold: 50% | minimumCalls: 5 | openTimeoutMs: 30s
const http = registry.getForHttpExternal('stripe-api');
// → circuit named 'http:stripe-api'

// Internal service-to-service calls
// - All errors count (internal services should not throw business errors at each other)
// - failureThreshold: 50% | minimumCalls: 5 | openTimeoutMs: 30s
const svc = registry.getForService('inventory-service');
// → circuit named 'service:inventory-service'

// Database operations
// - All errors count, more sensitive threshold and faster recovery
// - failureThreshold: 30% | minimumCalls: 3 | slidingWindowSize: 5 | openTimeoutMs: 15s
const db = registry.getForDatabase('orders_schema');
// → circuit named 'database:orders_schema'
```

| Method | Threshold | Window | Min calls | Open timeout | `isFailure` |
|--------|-----------|--------|-----------|-------------|-------------|
| `getForHttpExternal(name)` | 50% | 10 | 5 | 30s | `isHttpServerError` |
| `getForService(name)` | 50% | 10 | 5 | 30s | all errors |
| `getForDatabase(schema)` | 30% | 5 | 3 | 15s | all errors |

### Registry API

```typescript
// All metrics at once — useful for health endpoints
registry.getAllMetrics();
// → Record<string, CircuitBreakerMetrics>

// Only breakers that are OPEN or HALF_OPEN
registry.getOpenBreakers();
// → CircuitBreakerMetrics[]

// Reset a specific breaker (force-close + clear counters)
registry.reset('stripe-api');

// Reset all breakers
registry.resetAll();
```

---

## `isHttpServerError`

Built-in classifier that distinguishes HTTP client errors (business) from server errors (infrastructure).

```typescript
import { isHttpServerError } from '@backendkit-labs/circuit-breaker';

isHttpServerError(new Error('ECONNREFUSED'))     // → true  (infra — network error)
isHttpServerError({ getStatus: () => 500 })      // → true  (infra — server error)
isHttpServerError({ getStatus: () => 503 })      // → true  (infra — server error)
isHttpServerError({ getStatus: () => 404 })      // → false (business — not found)
isHttpServerError({ getStatus: () => 401 })      // → false (business — unauthorized)
isHttpServerError({ getStatus: () => 422 })      // → false (business — validation)
```

Works with NestJS `HttpException` and any object that implements `getStatus(): number`. Objects without `getStatus` are always treated as infrastructure errors.

---

## NestJS Integration

Import from the `/nestjs` subpath — framework code is tree-shaken from the core bundle.

### Module Setup

```typescript
import { CircuitBreakerModule } from '@backendkit-labs/circuit-breaker/nestjs';

@Module({
  imports: [CircuitBreakerModule],
})
export class AppModule {}
```

`CircuitBreakerModule` provides and exports:
- `CircuitBreakerRegistry` — injectable registry
- `CircuitBreakerService` — metrics + auto-monitoring
- `CircuitBreakerGuard` — for `@UseCircuitBreaker()`
- `CircuitBreakerInterceptor` — for global or per-controller wrapping

### Guard — per-route protection

Protects individual endpoints declaratively. Returns `503 Service Unavailable` when the circuit is `OPEN`.

```typescript
import {
  UseCircuitBreaker,
  CircuitBreakerGuard,
} from '@backendkit-labs/circuit-breaker/nestjs';

@Controller('payments')
export class PaymentsController {

  @Post()
  @UseCircuitBreaker({ name: 'stripe-api', failureThreshold: 40 })
  @UseGuards(CircuitBreakerGuard)
  charge(@Body() dto: ChargeDto) {
    return this.paymentsService.charge(dto);
  }

  @Get(':id')
  @UseCircuitBreaker({ name: 'stripe-api' }) // same circuit, shared state
  @UseGuards(CircuitBreakerGuard)
  getCharge(@Param('id') id: string) {
    return this.paymentsService.getCharge(id);
  }
}
```

`@UseCircuitBreaker` options:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `name` | `string` | required | Circuit breaker name (shared across routes with the same name) |
| `failureThreshold` | `number` | `50` | % failures to open the circuit |
| `isFailure` | `(error) => boolean` | `isHttpServerError` | Error classifier |

### Interceptor — auto-wrap every handler

Automatically creates one circuit breaker per controller method, named `handler:ClassName.methodName`. No decoration on individual routes required.

```typescript
import { CircuitBreakerInterceptor } from '@backendkit-labs/circuit-breaker/nestjs';

// Global — protects every handler in the application
app.useGlobalInterceptors(app.get(CircuitBreakerInterceptor));

// Or scoped to a controller
@UseInterceptors(CircuitBreakerInterceptor)
@Controller('reports')
export class ReportsController {
  @Get()
  findAll() { ... }
  // → circuit named 'handler:ReportsController.findAll'

  @Get(':id')
  findOne(@Param('id') id: string) { ... }
  // → circuit named 'handler:ReportsController.findOne'
}
```

Returns `503 Service Unavailable` when a circuit is `OPEN`. Uses `isHttpServerError` by default.

### Method Decorator

Wraps a service method inside a named circuit breaker. The class must have `circuitBreakerRegistry: CircuitBreakerRegistry` injected as a public property.

```typescript
import { Injectable, Inject } from '@nestjs/common';
import {
  CircuitBreakerRegistry,
  CircuitBreakerOpenError,
} from '@backendkit-labs/circuit-breaker';
import { WithCircuitBreaker } from '@backendkit-labs/circuit-breaker/nestjs';

@Injectable()
export class PaymentService {
  constructor(
    public readonly circuitBreakerRegistry: CircuitBreakerRegistry,
    private readonly stripeClient: StripeClient,
  ) {}

  // Basic usage
  @WithCircuitBreaker({ name: 'stripe', failureThreshold: 40 })
  async charge(dto: ChargeDto) {
    return this.stripeClient.charge(dto);
  }

  // With fallback for controlled degradation
  @WithCircuitBreaker({
    name:             'stripe',
    failureThreshold: 40,
    isFailure:        isHttpServerError,
    fallback: (err) => err instanceof CircuitBreakerOpenError
      ? { status: 'queued', message: 'Payment queued for processing' }
      : { status: 'error',  message: 'Payment temporarily unavailable' },
  })
  async chargeWithFallback(dto: ChargeDto) {
    return this.stripeClient.charge(dto);
  }
}
```

`@WithCircuitBreaker` options:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `name` | `string` | required | Circuit breaker name |
| `failureThreshold` | `number` | `50` | % failures to open the circuit |
| `openTimeoutMs` | `number` | `60000` | Wait in OPEN before probing |
| `isFailure` | `(error) => boolean` | `isHttpServerError` | Error classifier |
| `fallback` | `(error) => T \| Promise<T>` | `undefined` | Controlled exit on OPEN or infra error |

### `CircuitBreakerService` — monitoring

Injectable service that exposes registry metrics and runs automatic background monitoring.

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

  @Post('circuit-breakers/:name/reset')
  reset(@Param('name') name: string) {
    this.cb.reset(name);
  }
}
```

**Automatic monitoring:** `CircuitBreakerService` logs a warning every 60 seconds listing any `OPEN` breakers and their failure rates, and a notice for any breakers in `HALF_OPEN` state. No configuration needed — it starts when the module initializes and cleans up on shutdown.

---

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

The core is a pure TypeScript library with no runtime dependencies. The NestJS layer is in a separate subpath export (`/nestjs`) so it doesn't pollute the core bundle for non-NestJS users.

---

## License

Apache-2.0 — [BackendKit Labs](https://github.com/BackendKit-labs)
