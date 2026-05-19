# @backendkit-labs/again

Enterprise-grade retry library for Node.js — exponential backoff, sliding-window budget, error classification, circuit-breaker and bulkhead integration, and optional NestJS support. Returns `Result<T, AgainError>`, never throws.

[![npm](https://img.shields.io/npm/v/@backendkit-labs/again)](https://www.npmjs.com/package/@backendkit-labs/again)
[![license](https://img.shields.io/npm/l/@backendkit-labs/again)](LICENSE)
[![node](https://img.shields.io/node/v/@backendkit-labs/again)](package.json)

---

## Minimal Example

Self-contained runnable example — no NestJS, one file, realistic scenario.

```bash
git clone https://github.com/BackendKit-labs/backendkit-monorepo.git
cd backendkit-monorepo/examples/minimal-again
npm install && npm start
```

Shows a payment gateway that fails 60% of the time retried with exponential backoff + jitter. Lifecycle hooks log each attempt in real time. → [full source](https://github.com/BackendKit-labs/backendkit-monorepo/tree/master/examples/minimal-again)

---

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [AgainEngine — full control](#againengine--full-control)
- [Configuration Reference](#configuration-reference)
  - [maxAttempts](#maxattempts)
  - [backoff](#backoff)
  - [retryIf / abortIf](#retryif--abortif)
  - [timeout](#timeout)
  - [budget](#budget)
  - [hooks](#hooks)
  - [fallback](#fallback)
  - [dynamicDelay](#dynamicdelay)
  - [classifiers](#classifiers)
- [Backoff Strategies](#backoff-strategies)
- [Error Types](#error-types)
- [BackendKit Integrations](#backendkit-integrations)
  - [circuit-breaker](#backendkit-labscircuit-breaker)
  - [bulkhead](#backendkit-labsbulkhead)
  - [result](#backendkit-labsresult)
  - [observability](#backendkit-labsobservability)
  - [All three layers together](#all-three-layers-together)
- [NestJS Integration](#nestjs-integration)
- [AgainRegistry](#againregistry)
- [API Reference](#api-reference)

---

## Installation

```bash
npm install @backendkit-labs/again @backendkit-labs/result
```

NestJS peer dependencies (optional — only if using `AgainModule`):

```bash
npm install @nestjs/common @nestjs/core rxjs
```

---

## Quick Start

`again()` is a standalone function backed by a global registry. It covers 90% of use cases in two lines:

```typescript
import { again } from '@backendkit-labs/again';

const result = await again(() => fetchUser(userId), {
  maxAttempts: 3,
  backoff: { type: 'exponential', baseDelay: 200 },
});

result.match(
  (user) => res.json(user),
  (error) => res.status(502).json({ error: error.message }),
);
```

`again()` returns `Result<T, AgainError>` — it **never throws**. Use `.match()`, `.ok`, or `.error` to handle both paths.

### Minimal retry with default config

```typescript
// 3 attempts, fixed 200ms delay
const result = await again(() => callExternalApi());
```

### Handle specific error types

```typescript
const result = await again(() => chargePayment(order), {
  maxAttempts: 4,
  backoff: { type: 'exponential', baseDelay: 300, maxDelay: 5_000 },
});

if (!result.ok) {
  const { type, status, metadata } = result.error;
  if (type === 'http' && status === 429) {
    // rate-limited — already retried, still failed
  }
  console.log(`Failed after ${metadata.attempts} attempt(s)`);
}
```

---

## AgainEngine — full control

`AgainEngine` is the stateful core. Use it when you need shared configuration, per-engine metrics, or external integrations (circuit breaker, bulkhead, observability).

```typescript
import { AgainEngine } from '@backendkit-labs/again';
import { circuitBreaker } from '@backendkit-labs/circuit-breaker';
import { bulkhead } from '@backendkit-labs/bulkhead';

const engine = new AgainEngine({
  name: 'payment-gateway',
  defaultConfig: {
    maxAttempts: 3,
    backoff: { type: 'exponential', baseDelay: 200, maxDelay: 8_000, jitter: 'full' },
    timeout: { attemptTimeoutMs: 5_000, globalTimeoutMs: 20_000 },
  },
  integrations: {
    circuitBreaker: circuitBreaker({ failureThreshold: 5, cooldownMs: 10_000 }),
    bulkhead: bulkhead({ maxConcurrent: 10, maxQueue: 20 }),
    observability: {
      logger: myLogger,
      metrics: myMetricsEmitter,
    },
  },
});

const result = await engine.execute(() => chargePayment(order));

// Per-execution overrides
const result2 = await engine.execute(
  () => refundPayment(order),
  { maxAttempts: 5 },
);

// With correlationId for distributed tracing
const result3 = await engine.executeWithContext(
  () => fetchInventory(productId),
  { correlationId: req.headers['x-request-id'] },
);
```

---

## Configuration Reference

All options are in `AgainConfig`. Every field except `maxAttempts` and `backoff` is optional.

```typescript
interface AgainConfig {
  maxAttempts: number;
  backoff: BackoffConfig | BackoffStrategy;
  retryIf?: AgainCondition | AgainConditionFn;
  abortIf?: AbortCondition | AbortConditionFn;
  timeout?: Partial<TimeoutConfig>;
  budget?: Partial<AgainBudgetConfig>;
  idempotency?: Partial<IdempotencyConfig>;
  classifiers?: ClassifierRule[];
  dynamicDelay?: (error: AgainErrorPayload, attempt: number) => number;
  hooks?: AgainHooks;
  fallback?: (error: AgainErrorPayload) => unknown | Promise<unknown>;
  correlationId?: string;
}
```

### maxAttempts

Total number of attempts including the first one. `maxAttempts: 3` means one initial call plus two retries.

```typescript
await again(task, { maxAttempts: 5 });
```

### backoff

Controls the delay between retries. Accepts a config object (shorthand) or a `BackoffStrategy` instance (composable). See [Backoff Strategies](#backoff-strategies) for all options.

```typescript
// Shorthand (most common)
{ backoff: { type: 'exponential', baseDelay: 200, maxDelay: 10_000, jitter: 'full' } }

// Strategy instance (composable)
import { ExponentialBackoff, JitterDecorator } from '@backendkit-labs/again';
const strategy = new JitterDecorator(new ExponentialBackoff({ baseDelay: 200 }), 'full');
{ backoff: strategy }
```

### retryIf / abortIf

Fine-grained control over which errors trigger a retry and which abort immediately.

```typescript
await again(task, {
  // Only retry on network errors and 5xx responses
  retryIf: (error) => error.type === 'network' || (error.type === 'http' && (error.status ?? 0) >= 500),

  // Abort immediately on 401/403 — retrying is pointless
  abortIf: (error) => error.type === 'http' && [401, 403].includes(error.status ?? 0),
});
```

Both accept a plain function `(error: AgainErrorPayload) => boolean | Promise<boolean>` or an object implementing `AgainCondition` / `AbortCondition`. Default behavior: retry on 5xx, network, and timeout errors; abort on 4xx (except 429).

### timeout

Per-attempt and global timeouts are independent:

```typescript
await again(task, {
  timeout: {
    attemptTimeoutMs: 5_000,  // each individual call is capped at 5s
    globalTimeoutMs: 30_000,  // entire retry operation (including delays) capped at 30s
  },
});
```

- `attemptTimeoutMs` expiration → error classified as `type: 'timeout'` → triggers retry (if retryable)
- `globalTimeoutMs` expiration → operation aborted immediately regardless of attempt count
- `0` means unlimited (default)

### budget

Sliding-window budget prevents retry storms. If the ratio of retries to total calls exceeds `maxRetryRatio` in the last `windowMs` milliseconds, further retries are rejected.

```typescript
await again(task, {
  budget: {
    windowMs: 60_000,       // 1-minute sliding window
    maxRetryRatio: 0.1,     // max 10% of calls may be retries
    minRequestCount: 20,    // budget not enforced until at least 20 calls
  },
});
```

Budget exhaustion produces `type: 'unknown'` with `metadata.budgetExhausted: true`. Share a budget across calls by reusing the same `AgainEngine` instance.

### hooks

Lifecycle hooks for observability, logging, and debugging. Hook errors are swallowed and never affect retry state.

```typescript
await again(task, {
  hooks: {
    beforeRetry: ({ attempt, delayMs, error }) => {
      logger.warn(`Retry #${attempt} in ${delayMs}ms — ${error.message}`);
    },
    afterRetry: ({ attempt, error }) => {
      logger.debug(`Attempt ${attempt} finished with error: ${error.type}`);
    },
    onRetrySuccess: ({ attempt, totalAttempts, totalElapsedMs }) => {
      logger.info(`Succeeded on attempt ${attempt}/${totalAttempts} (${totalElapsedMs}ms total)`);
    },
    onExhausted: ({ lastError, totalAttempts, totalElapsedMs }) => {
      logger.error(`All ${totalAttempts} attempts failed in ${totalElapsedMs}ms`, lastError);
    },
    onBudgetExhausted: () => {
      logger.warn('Retry budget exhausted — skipping retry');
    },
  },
});
```

### fallback

Return a default value when all retries are exhausted instead of returning `err(...)`:

```typescript
const result = await again(() => fetchConfig(), {
  maxAttempts: 3,
  fallback: () => DEFAULT_CONFIG,
});

// result.ok === true, result.value === DEFAULT_CONFIG
```

### dynamicDelay

Override backoff with a delay computed from the error — useful for respecting `Retry-After` headers:

```typescript
await again(task, {
  dynamicDelay: (error, attempt) => {
    if (error.type === 'http' && error.status === 429) {
      // Use Retry-After header value if available in cause
      const retryAfterMs = (error.cause as any)?.retryAfterMs ?? 5_000;
      return retryAfterMs;
    }
    return 0; // 0 = fall back to backoff strategy
  },
});
```

### classifiers

Add custom rules that classify errors as `'transient'` (retryable) or `'permanent'` (abort):

```typescript
await again(task, {
  classifiers: [
    {
      name: 'business-validation',
      priority: 1,                    // evaluated before built-in rules
      match: (error) => error.type === 'http' && error.status === 422,
      classification: 'permanent',
    },
    {
      name: 'gateway-timeout',
      priority: 50,
      match: (error) => error.type === 'http' && error.status === 504,
      classification: 'transient',
    },
  ],
});
```

Built-in rules (lower priority number = evaluated first):

| Status / Type | Classification |
|---|---|
| 400, 401, 403, 404, 413, 422 | permanent |
| 429, 500–599 | transient |
| `network`, `timeout` | transient |
| `circuit-open`, `bulkhead-rejected` | transient |
| everything else | permanent |

---

## Backoff Strategies

Three built-in strategies, all composable with `JitterDecorator`:

### Fixed

Same delay every time:

```typescript
import { FixedBackoff } from '@backendkit-labs/again';

new FixedBackoff({ baseDelay: 500 });
// attempt 1→2: 500ms, 2→3: 500ms, ...
```

Shorthand: `{ type: 'fixed', baseDelay: 500 }`

### Linear

Delay grows linearly:

```typescript
import { LinearBackoff } from '@backendkit-labs/again';

new LinearBackoff({ baseDelay: 200, multiplier: 1.5, maxDelay: 5_000 });
// attempt 1→2: 200ms, 2→3: 300ms, 3→4: 450ms, ...
```

Shorthand: `{ type: 'linear', baseDelay: 200, multiplier: 1.5, maxDelay: 5_000 }`

### Exponential

Delay doubles (or scales by `multiplier`) each attempt:

```typescript
import { ExponentialBackoff } from '@backendkit-labs/again';

new ExponentialBackoff({ baseDelay: 200, multiplier: 2, maxDelay: 30_000, jitter: 'full' });
// attempt 1→2: ~200ms, 2→3: ~400ms, 3→4: ~800ms, ...
```

Shorthand: `{ type: 'exponential', baseDelay: 200, maxDelay: 30_000, jitter: 'full' }`

Jitter types: `'full'` (uniform random in [0, delay]), `'equal'` (delay/2 + random in [0, delay/2]), `'decorrelated'` (delay based on previous delay × random).

### JitterDecorator

Wrap any strategy with jitter:

```typescript
import { LinearBackoff, JitterDecorator } from '@backendkit-labs/again';

const strategy = new JitterDecorator(
  new LinearBackoff({ baseDelay: 300 }),
  'full',
);
```

---

## Error Types

`AgainError` is the union of `AgainErrorPayload` and `AgainMetadata`:

```typescript
type AgainError = AgainErrorPayload & { metadata: AgainMetadata };

interface AgainErrorPayload {
  type: ErrorType;     // 'http' | 'network' | 'timeout' | 'circuit-open' | 'bulkhead-rejected' | 'business' | 'unknown'
  message: string;
  status?: number;     // HTTP status code (only when type === 'http')
  cause?: unknown;     // original thrown error
  attempt: number;     // attempt number when this error occurred
  elapsedMs: number;   // elapsed ms at this point
}

interface AgainMetadata {
  attempts: number;          // total attempts made
  totalElapsedMs: number;    // total operation duration
  lastError?: AgainErrorPayload;
  budgetExhausted?: boolean; // true if stopped by budget
  circuitOpen?: boolean;     // true if stopped by circuit breaker
}
```

Handling different error types:

```typescript
const result = await again(() => callApi());

if (!result.ok) {
  const error = result.error;

  switch (error.type) {
    case 'http':
      console.log(`HTTP ${error.status} after ${error.metadata.attempts} attempts`);
      break;
    case 'timeout':
      console.log(`Timed out after ${error.metadata.totalElapsedMs}ms`);
      break;
    case 'circuit-open':
      console.log('Circuit breaker is OPEN — fast-failed without retrying');
      break;
    case 'network':
      console.log('Network error:', error.cause);
      break;
  }
}
```

---

## BackendKit Integrations

All integrations are **duck-typed** — `again` never imports any other BackendKit library at compile time. You connect them by passing the instance directly to `AgainEngine`. Any object that satisfies the minimal interface works, including mocks in tests.

---

### `@backendkit-labs/circuit-breaker`

The circuit breaker controls whether to attempt a call. `again` checks it before each attempt:

```typescript
import { CircuitBreaker } from '@backendkit-labs/circuit-breaker';
import { AgainEngine } from '@backendkit-labs/again';

const cb = new CircuitBreaker({ name: 'payments', threshold: 5 });

const engine = new AgainEngine({
  name: 'payments',
  integrations: {
    circuitBreaker: cb,  // duck-typed: canAttempt() / onSuccess() / onError()
  },
});

const result = await engine.execute(() => chargePayment(order));

if (!result.ok && result.error.type === 'circuit-open') {
  // Breaker was OPEN — again returned immediately without calling the task
}
```

**Execution flow:**
1. `again` calls `cb.canAttempt()` before every attempt. If `false` → returns `{ type: 'circuit-open' }` immediately.
2. On success → `cb.onSuccess(durationMs)` — registers the healthy call.
3. On transient failure → `cb.onError(err)` — updates the breaker's failure counter.
4. On permanent/business failure (e.g. 422) → CB is **not** notified — this is not an infrastructure problem.

**The real value:** the circuit breaker stops calls when the service is known to be down. `again` acts as the gradual recovery mechanism — it waits with backoff and retries when the breaker transitions to half-open.

---

### `@backendkit-labs/bulkhead`

Limits the concurrency of attempts. Every attempt — including retries — passes through the bulkhead:

```typescript
import { Bulkhead } from '@backendkit-labs/bulkhead';
import { AgainEngine } from '@backendkit-labs/again';

const bulkhead = new Bulkhead({ maxConcurrent: 10, maxQueue: 20 });

const engine = new AgainEngine({
  name: 'orders',
  integrations: {
    bulkhead,  // duck-typed: execute(fn) / isFull()
  },
});
```

**Execution flow:**
- Each attempt (including retries) is wrapped in `bulkhead.execute(fn)`.
- If the bulkhead is full → it rejects → `again` classifies as `type: 'bulkhead-rejected'` (transient by default) → waits with backoff and re-queues.

---

### `@backendkit-labs/result`

`again()` already returns `Result<T, AgainError>` — direct integration, no adapter needed:

```typescript
import { again } from '@backendkit-labs/again';

const result = await again(() => fetchOrder(id), {
  maxAttempts: 3,
  backoff: { type: 'exponential', baseDelay: 200 },
});

result.match(
  (order) => res.json(order),
  (err)   => res.status(502).json({ message: err.message, attempts: err.metadata.attempts }),
);
```

When combining with `@backendkit-labs/http-client` (which also returns `Result`), unwrap between layers so `again` sees a thrown error instead of a nested `Result`:

```typescript
const result = await again(
  async () => {
    const r = await httpClient.get<Order>('/orders/1');
    if (!r.ok) throw Object.assign(new Error(r.error.message), { status: r.error.status });
    return r.value;
  },
  { maxAttempts: 3, backoff: { type: 'exponential', baseDelay: 100 } },
);
```

The thrown error with a `.status` property is detected as `type: 'http'` and classified correctly by the built-in rules.

---

### `@backendkit-labs/observability`

Plug in any logger and metrics emitter that satisfy the minimal duck-typed interfaces:

```typescript
import { Logger } from '@backendkit-labs/observability';

const logger = new Logger({ service: 'payments' });

const engine = new AgainEngine({
  name: 'payments',
  integrations: {
    observability: {
      logger,                         // info / warn / error
      metrics: metricsRegistry,       // emit(event)
    },
  },
});
```

**Logs emitted automatically:**

```
WARN  "again: attempt failed"  { attempt: 2, type: 'http', classification: 'transient' }
ERROR "again: exhausted"       { attempts: 3, type: 'http', totalElapsedMs: 1842 }
```

**Metrics emitted automatically:**

| Metric | When | Tags |
|---|---|---|
| `again.attempt_failed` | After each failed attempt | `attempt`, `type`, `classification` |
| `again.success` | On eventual success | `attempt` (attempt number that succeeded) |
| `again.exhausted` | All retries exhausted | `type` |
| `again.budget_exhausted` | Budget refused a retry | — |

---

### All three layers together

The most complete pattern for a production service — circuit breaker, bulkhead, budget, timeout, and observability in a single engine:

```typescript
import { CircuitBreaker } from '@backendkit-labs/circuit-breaker';
import { Bulkhead }        from '@backendkit-labs/bulkhead';
import { Logger }          from '@backendkit-labs/observability';
import { AgainEngine }     from '@backendkit-labs/again';

const cb       = new CircuitBreaker({ name: 'payments', threshold: 5 });
const bulkhead = new Bulkhead({ maxConcurrent: 10, maxQueue: 20 });
const logger   = new Logger({ service: 'payments-client' });

const engine = new AgainEngine({
  name: 'payments-client',
  defaultConfig: {
    maxAttempts: 4,
    backoff:  { type: 'exponential', baseDelay: 200, maxDelay: 5_000, jitter: 'full' },
    budget:   { windowMs: 60_000, maxRetryRatio: 0.15 },  // max 15% retries per minute
    timeout:  { attemptTimeoutMs: 3_000, globalTimeoutMs: 12_000 },
  },
  integrations: {
    circuitBreaker: cb,
    bulkhead,
    observability: { logger, metrics: metricsRegistry },
  },
});

const result = await engine.execute(() => chargePayment(order));
```

**What happens per attempt:**

```
budget.recordCall()
→ checkGlobalTimeout()              ← abort if 12s total exceeded
→ cb.canAttempt()                   ← fast-fail if circuit is OPEN
→ bulkhead.execute(...)             ← limit concurrency
→ executeWithAttemptTimeout(3_000)  ← cap each call at 3s
→ success:  cb.onSuccess() / budget.recordSuccess()
→ failure:  cb.onError()  / budget.recordFailure()
            → abort? retry? budget exhausted? → backoff and loop
```

---

## NestJS Integration

Import `AgainModule` once at the application root. It registers `AgainService` and an optional global `AgainInterceptor`.

### Module setup

```typescript
import { AgainModule } from '@backendkit-labs/again/nestjs';

@Module({
  imports: [
    AgainModule.forRoot({
      engineConfig: {
        name: 'default',
        defaultConfig: {
          maxAttempts: 3,
          backoff: { type: 'exponential', baseDelay: 200, jitter: 'full' },
        },
      },
      globalInterceptor: false, // set true to apply @Again to all controllers globally
    }),
  ],
})
export class AppModule {}
```

### AgainService — inject and execute

```typescript
import { Injectable } from '@nestjs/common';
import { AgainService } from '@backendkit-labs/again/nestjs';

@Injectable()
export class PaymentsService {
  constructor(private readonly again: AgainService) {}

  async charge(order: Order) {
    const result = await this.again.execute(
      () => this.gateway.charge(order),
      { maxAttempts: 4, backoff: { type: 'exponential', baseDelay: 300 } },
    );

    if (!result.ok) throw new ServiceUnavailableException(result.error.message);
    return result.value;
  }
}
```

### @Again decorator

Mark a method for retry without changing its signature. Pairs with `AgainInterceptor`:

```typescript
import { Again } from '@backendkit-labs/again/nestjs';

@Injectable()
export class InventoryService {
  @Again({
    maxAttempts: 3,
    backoff: { type: 'exponential', baseDelay: 150 },
  })
  async reserveStock(productId: string, quantity: number) {
    return this.http.post('/inventory/reserve', { productId, quantity });
  }
}
```

### DI tokens

Inject the underlying engine or registry directly:

```typescript
import { Inject } from '@nestjs/common';
import { AGAIN_ENGINE_TOKEN, AGAIN_REGISTRY_TOKEN } from '@backendkit-labs/again/nestjs';
import type { AgainEngine, AgainRegistry } from '@backendkit-labs/again';

@Injectable()
export class MyService {
  constructor(
    @Inject(AGAIN_ENGINE_TOKEN) private engine: AgainEngine,
    @Inject(AGAIN_REGISTRY_TOKEN) private registry: AgainRegistry,
  ) {}
}
```

---

## AgainRegistry

`AgainRegistry` manages named `AgainEngine` instances — useful when different services need different retry configurations in the same process.

```typescript
import { AgainRegistry } from '@backendkit-labs/again';

const registry = new AgainRegistry();

const paymentEngine = registry.getOrCreate('payments', {
  defaultConfig: { maxAttempts: 3, backoff: { type: 'exponential', baseDelay: 300 } },
});

const emailEngine = registry.getOrCreate('email', {
  defaultConfig: { maxAttempts: 5, backoff: { type: 'fixed', baseDelay: 1_000 } },
});

// Retrieve later by name
const engine = registry.get('payments');

// Metrics snapshot for all engines
const allMetrics = registry.getAllMetrics();

// Reset a specific engine's state
registry.reset('payments');
```

---

## API Reference

### `again(task, options?)`

Standalone function using a global default registry.

| Param | Type | Description |
|---|---|---|
| `task` | `() => Promise<T>` | The async operation to retry |
| `options` | `Partial<AgainConfig>` | Optional config overrides |
| Returns | `Promise<Result<T, AgainError>>` | Never throws |

### `AgainEngine`

| Method | Signature | Description |
|---|---|---|
| `execute` | `<T>(task, options?) => Promise<Result<T, AgainError>>` | Execute with retry |
| `executeWithContext` | `<T>(task, { correlationId? }, options?) => Promise<Result<T, AgainError>>` | Execute with correlationId |
| `updateDefaults` | `(partial: Partial<AgainConfig>) => void` | Update engine defaults at runtime |
| `getMetrics` | `() => AgainMetricsSnapshot` | Get current metrics |
| `resetMetrics` | `() => void` | Reset metrics counters |

### `AgainRegistry`

| Method | Signature | Description |
|---|---|---|
| `getOrCreate` | `(name, config?) => AgainEngine` | Get or create a named engine |
| `get` | `(name) => AgainEngine \| undefined` | Get engine by name |
| `reset` | `(name) => void` | Remove a named engine |
| `resetAll` | `() => void` | Remove all engines |
| `getAllMetrics` | `() => Record<string, AgainMetricsSnapshot>` | Metrics for all engines |

### NestJS exports (`@backendkit-labs/again/nestjs`)

| Export | Type | Description |
|---|---|---|
| `AgainModule` | `DynamicModule` | `AgainModule.forRoot(options?)` |
| `AgainService` | `Injectable` | `.execute(task, options?)` |
| `Again` | `MethodDecorator` | `@Again(config)` |
| `AgainInterceptor` | `NestInterceptor` | Intercepts methods decorated with `@Again` |
| `AGAIN_ENGINE_TOKEN` | `string` | DI token for `AgainEngine` |
| `AGAIN_REGISTRY_TOKEN` | `string` | DI token for `AgainRegistry` |

---

## License

Apache-2.0 — see [LICENSE](LICENSE) for details.

Part of the [BackendKit Labs](https://backendkitlabs.dev) ecosystem.
