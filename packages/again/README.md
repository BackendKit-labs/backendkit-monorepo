# @backendkit-labs/again

Enterprise-grade retry library for Node.js — exponential backoff, sliding-window budget, error classification, circuit-breaker and bulkhead integration, and optional NestJS support. Returns `Result<T, AgainError>`, never throws.

[![npm](https://img.shields.io/npm/v/@backendkit-labs/again)](https://www.npmjs.com/package/@backendkit-labs/again)
[![license](https://img.shields.io/npm/l/@backendkit-labs/again)](LICENSE)
[![node](https://img.shields.io/node/v/@backendkit-labs/again)](package.json)

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
- [Circuit Breaker Integration](#circuit-breaker-integration)
- [Bulkhead Integration](#bulkhead-integration)
- [Observability Integration](#observability-integration)
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

## Circuit Breaker Integration

`again` integrates with any circuit breaker that implements `CircuitBreakerLike` — including `@backendkit-labs/circuit-breaker`. No import required; pass the instance via `integrations`.

```typescript
import { AgainEngine } from '@backendkit-labs/again';
import { circuitBreaker } from '@backendkit-labs/circuit-breaker';

const cb = circuitBreaker({ failureThreshold: 5, cooldownMs: 10_000 });

const engine = new AgainEngine({
  name: 'external-api',
  integrations: { circuitBreaker: cb },
});

const result = await engine.execute(() => fetchData());

if (!result.ok && result.error.type === 'circuit-open') {
  // Circuit is OPEN — again did not attempt the call
}
```

**How it works:**
1. Before the retry loop, `again` checks `circuitBreaker.canAttempt()`. If `false`, returns immediately with `type: 'circuit-open'`.
2. After each attempt: success → `onSuccess(durationMs)`; transient error → `onError(error)`. Permanent/business errors are not reported to the CB (they're not infrastructure problems).

---

## Bulkhead Integration

Wrap each attempt in a bulkhead slot with any object implementing `BulkheadLike`:

```typescript
import { AgainEngine } from '@backendkit-labs/again';
import { bulkhead } from '@backendkit-labs/bulkhead';

const bh = bulkhead({ maxConcurrent: 10, maxQueue: 20 });

const engine = new AgainEngine({
  name: 'db-calls',
  integrations: { bulkhead: bh },
});
```

When the bulkhead rejects a call, `again` classifies it as `type: 'bulkhead-rejected'` (transient) and retries with backoff.

---

## Observability Integration

Plug in any logger and metrics emitter via `integrations.observability`:

```typescript
const engine = new AgainEngine({
  name: 'payments',
  integrations: {
    observability: {
      logger: {
        info:  (msg, meta) => pino.info(meta, msg),
        warn:  (msg, meta) => pino.warn(meta, msg),
        error: (msg, meta) => pino.error(meta, msg),
      },
      metrics: {
        emit: ({ name, value, tags }) => statsd.increment(name, value, tags),
      },
    },
  },
});
```

Events emitted automatically:

| Event | When |
|---|---|
| `again.attempt` | After each attempt (tags: `engine`, `attempt`, `error_type`) |
| `again.success` | On eventual success (tags: `engine`, `attempts`) |
| `again.exhausted` | All retries exhausted (tags: `engine`, `error_type`) |
| `again.budget_exhausted` | Budget refused retry (tags: `engine`) |

Logs emitted: `warn` before each retry, `error` on exhaustion.

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
