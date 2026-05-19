---
title: Retry
description: Enterprise retry for Node.js — exponential backoff, sliding-window budget, error classification, circuit-breaker and bulkhead integration. Returns Result<T, RetryError>, never throws.
---

# @backendkit-labs/retry

[![npm](https://img.shields.io/npm/v/@backendkit-labs/retry?style=flat-square&color=cb3837)](https://www.npmjs.com/package/@backendkit-labs/retry)
[![License](https://img.shields.io/npm/l/@backendkit-labs/retry?style=flat-square)](https://github.com/BackendKit-labs/backendkit-monorepo/blob/master/LICENSE)
[![Node](https://img.shields.io/node/v/@backendkit-labs/retry?style=flat-square)](https://nodejs.org)

> Enterprise retry for Node.js — exponential backoff, sliding-window budget, error classification, circuit-breaker and bulkhead integration. Returns `Result<T, RetryError>`, never throws.

## Installation

```bash
npm install @backendkit-labs/retry @backendkit-labs/result
```

NestJS peer dependencies (optional):

```bash
npm install @nestjs/common @nestjs/core rxjs
```

## Quick Start

`retry()` is a standalone function backed by a global registry. Covers 90% of use cases in two lines:

```typescript
import { retry } from '@backendkit-labs/retry';

const result = await retry(() => fetchUser(userId), {
  maxAttempts: 3,
  backoff: { type: 'exponential', baseDelay: 200 },
});

result.match(
  (user)  => res.json(user),
  (error) => res.status(502).json({ error: error.message }),
);
```

`retry()` returns `Result<T, RetryError>` — it **never throws**. Use `.match()`, `.ok`, or `.error` to handle both paths.

## Core API

### `retry(task, options?)`

Standalone function using a global default registry.

| Param | Type | Description |
|-------|------|-------------|
| `task` | `() => Promise<T>` | The async operation to retry |
| `options` | `Partial<RetryConfig>` | Optional config overrides |
| Returns | `Promise<Result<T, RetryError>>` | Never throws |

```typescript
// Defaults: 3 attempts, fixed 200ms delay
const result = await retry(() => callExternalApi());
```

### `RetryEngine`

Stateful core for shared config, metrics, and external integrations (circuit breaker, bulkhead, observability).

```typescript
import { RetryEngine } from '@backendkit-labs/retry';

const engine = new RetryEngine({
  name: 'payment-gateway',
  defaultConfig: {
    maxAttempts: 3,
    backoff: { type: 'exponential', baseDelay: 200, maxDelay: 8_000, jitter: 'full' },
    timeout: { attemptTimeoutMs: 5_000, globalTimeoutMs: 20_000 },
  },
});

const result = await engine.execute(() => chargePayment(order));

// Per-execution override
const result2 = await engine.execute(() => refundPayment(order), { maxAttempts: 5 });

// With correlationId for distributed tracing
const result3 = await engine.executeWithContext(
  () => fetchInventory(productId),
  { correlationId: req.headers['x-request-id'] },
);
```

| Method | Signature | Description |
|--------|-----------|-------------|
| `execute` | `<T>(task, options?) => Promise<Result<T, RetryError>>` | Execute with retry |
| `executeWithContext` | `<T>(task, ctx, options?) => Promise<Result<T, RetryError>>` | Execute with correlationId |
| `updateDefaults` | `(partial: Partial<RetryConfig>) => void` | Update defaults at runtime |
| `getMetrics` | `() => RetryMetricsSnapshot` | Current metrics |
| `resetMetrics` | `() => void` | Reset counters |

## Configuration Reference

```typescript
interface RetryConfig {
  maxAttempts: number;
  backoff: BackoffConfig | BackoffStrategy;
  retryIf?:     RetryCondition | RetryConditionFn;
  abortIf?:     AbortCondition | AbortConditionFn;
  timeout?:     Partial<TimeoutConfig>;
  budget?:      Partial<RetryBudgetConfig>;
  classifiers?: ClassifierRule[];
  dynamicDelay?: (error: RetryErrorPayload, attempt: number) => number;
  hooks?:       RetryHooks;
  fallback?:    (error: RetryErrorPayload) => unknown | Promise<unknown>;
  correlationId?: string;
}
```

### `maxAttempts`

Total attempts including the first. `maxAttempts: 3` = one initial call + two retries.

### `backoff`

Controls delay between retries. Accepts a config shorthand or a `BackoffStrategy` instance.

```typescript
// Shorthand
{ backoff: { type: 'exponential', baseDelay: 200, maxDelay: 10_000, jitter: 'full' } }

// Strategy instance (composable)
import { ExponentialBackoff, JitterDecorator } from '@backendkit-labs/retry';
{ backoff: new JitterDecorator(new ExponentialBackoff({ baseDelay: 200 }), 'full') }
```

Available strategies: `'fixed'`, `'linear'`, `'exponential'`. Jitter types: `'full'`, `'equal'`, `'decorrelated'`.

### `retryIf` / `abortIf`

Fine-grained control over which errors trigger a retry and which abort immediately.

```typescript
await retry(task, {
  retryIf: (error) => error.type === 'network' || (error.type === 'http' && (error.status ?? 0) >= 500),
  abortIf: (error) => error.type === 'http' && [401, 403].includes(error.status ?? 0),
});
```

Default: retry on 5xx, network, and timeout; abort on 4xx (except 429).

### `timeout`

```typescript
await retry(task, {
  timeout: {
    attemptTimeoutMs: 5_000,  // each call capped at 5s
    globalTimeoutMs: 30_000,  // entire operation (including delays) capped at 30s
  },
});
```

### `budget`

Sliding-window budget prevents retry storms. Rejects retries when the retry ratio exceeds `maxRetryRatio` within `windowMs`.

```typescript
await retry(task, {
  budget: {
    windowMs:        60_000,  // 1-minute sliding window
    maxRetryRatio:   0.1,     // max 10% of calls may be retries
    minRequestCount: 20,      // not enforced until at least 20 calls
  },
});
```

### `hooks`

Lifecycle hooks for observability. Hook errors are swallowed and never affect retry state.

```typescript
await retry(task, {
  hooks: {
    beforeRetry:      ({ attempt, delayMs, error }) => logger.warn(`Retry #${attempt} in ${delayMs}ms`),
    afterRetry:       ({ attempt, error })           => logger.debug(`Attempt ${attempt} done`),
    onRetrySuccess:   ({ attempt, totalElapsedMs })  => logger.info(`Recovered on attempt ${attempt}`),
    onExhausted:      ({ lastError, totalAttempts }) => logger.error(`Failed after ${totalAttempts} attempts`),
    onBudgetExhausted: ()                            => logger.warn('Budget exhausted'),
  },
});
```

### `fallback`

Return a default value when all retries are exhausted:

```typescript
const result = await retry(() => fetchConfig(), {
  maxAttempts: 3,
  fallback: () => DEFAULT_CONFIG,
});
// result.ok === true, result.value === DEFAULT_CONFIG
```

### `dynamicDelay`

Override backoff with a delay computed from the error — useful for `Retry-After` headers:

```typescript
await retry(task, {
  dynamicDelay: (error, attempt) => {
    if (error.type === 'http' && error.status === 429) {
      return (error.cause as any)?.retryAfterMs ?? 5_000;
    }
    return 0; // 0 = fall back to backoff strategy
  },
});
```

## Error Types

```typescript
type RetryError = RetryErrorPayload & { metadata: RetryMetadata };

interface RetryErrorPayload {
  type: 'http' | 'network' | 'timeout' | 'circuit-open' | 'bulkhead-rejected' | 'business' | 'unknown';
  message: string;
  status?: number;   // HTTP status (only when type === 'http')
  cause?: unknown;   // original thrown error
  attempt: number;
  elapsedMs: number;
}

interface RetryMetadata {
  attempts: number;
  totalElapsedMs: number;
  lastError?: RetryErrorPayload;
  budgetExhausted?: boolean;
  circuitOpen?: boolean;
}
```

```typescript
if (!result.ok) {
  const { type, status, metadata } = result.error;
  switch (type) {
    case 'http':         console.log(`HTTP ${status} after ${metadata.attempts} attempts`); break;
    case 'timeout':      console.log(`Timed out after ${metadata.totalElapsedMs}ms`); break;
    case 'circuit-open': console.log('Fast-failed — circuit breaker is OPEN'); break;
    case 'network':      console.log('Network error:', result.error.cause); break;
  }
}
```

Built-in classification rules:

| Status / Type | Classification |
|---|---|
| 400, 401, 403, 404, 413, 422 | permanent (abort) |
| 429, 500–599 | transient (retry) |
| `network`, `timeout` | transient (retry) |
| `circuit-open`, `bulkhead-rejected` | transient (retry) |

## BackendKit Integrations

All integrations are **duck-typed** — `retry` never imports other BackendKit packages at compile time. Pass the instance directly to `RetryEngine`.

### Circuit Breaker

```typescript
import { CircuitBreaker } from '@backendkit-labs/circuit-breaker';

const cb = new CircuitBreaker({ name: 'payments', threshold: 5 });

const engine = new RetryEngine({
  name: 'payments',
  integrations: { circuitBreaker: cb },
});
```

Before each attempt: calls `cb.canAttempt()`. Returns `{ type: 'circuit-open' }` immediately if `false`. On success → `cb.onSuccess()`. On transient failure → `cb.onError()`.

### Bulkhead

```typescript
import { Bulkhead } from '@backendkit-labs/bulkhead';

const bulkhead = new Bulkhead({ maxConcurrent: 10, maxQueue: 20 });

const engine = new RetryEngine({
  name: 'orders',
  integrations: { bulkhead },
});
```

Every attempt (including retries) passes through `bulkhead.execute()`. Rejection → classified as `'bulkhead-rejected'` → retried with backoff.

### Full production stack

Circuit breaker + bulkhead + budget + timeout + observability in a single engine:

```typescript
import { CircuitBreaker } from '@backendkit-labs/circuit-breaker';
import { Bulkhead }        from '@backendkit-labs/bulkhead';
import { Logger }          from '@backendkit-labs/observability';
import { RetryEngine }     from '@backendkit-labs/retry';

const engine = new RetryEngine({
  name: 'payments-client',
  defaultConfig: {
    maxAttempts: 4,
    backoff:  { type: 'exponential', baseDelay: 200, maxDelay: 5_000, jitter: 'full' },
    budget:   { windowMs: 60_000, maxRetryRatio: 0.15 },
    timeout:  { attemptTimeoutMs: 3_000, globalTimeoutMs: 12_000 },
  },
  integrations: {
    circuitBreaker: new CircuitBreaker({ name: 'payments', threshold: 5 }),
    bulkhead:       new Bulkhead({ maxConcurrent: 10, maxQueue: 20 }),
    observability:  { logger: new Logger({ service: 'payments-client' }), metrics: metricsRegistry },
  },
});

const result = await engine.execute(() => chargePayment(order));
```

## RetryRegistry

Manages named `RetryEngine` instances — different configs per service in the same process.

```typescript
import { RetryRegistry } from '@backendkit-labs/retry';

const registry = new RetryRegistry();

const paymentEngine = registry.getOrCreate('payments', {
  defaultConfig: { maxAttempts: 3, backoff: { type: 'exponential', baseDelay: 300 } },
});

const emailEngine = registry.getOrCreate('email', {
  defaultConfig: { maxAttempts: 5, backoff: { type: 'fixed', baseDelay: 1_000 } },
});

registry.getAllMetrics(); // Record<string, RetryMetricsSnapshot>
registry.reset('payments');
```

## NestJS Integration

```typescript
import { RetryModule } from '@backendkit-labs/retry/nestjs';

@Module({
  imports: [
    RetryModule.forRoot({
      engineConfig: {
        name: 'default',
        defaultConfig: {
          maxAttempts: 3,
          backoff: { type: 'exponential', baseDelay: 200, jitter: 'full' },
        },
      },
      globalInterceptor: false,
    }),
  ],
})
export class AppModule {}
```

### RetryService

```typescript
@Injectable()
export class PaymentsService {
  constructor(private readonly retry: RetryService) {}

  async charge(order: Order) {
    const result = await this.retry.execute(
      () => this.gateway.charge(order),
      { maxAttempts: 4, backoff: { type: 'exponential', baseDelay: 300 } },
    );
    if (!result.ok) throw new ServiceUnavailableException(result.error.message);
    return result.value;
  }
}
```

### `@Retry` decorator

```typescript
import { Retry } from '@backendkit-labs/retry/nestjs';

@Injectable()
export class InventoryService {
  @Retry({ maxAttempts: 3, backoff: { type: 'exponential', baseDelay: 150 } })
  async reserveStock(productId: string, quantity: number) {
    return this.http.post('/inventory/reserve', { productId, quantity });
  }
}
```

### DI tokens

```typescript
import { RETRY_ENGINE_TOKEN, RETRY_REGISTRY_TOKEN } from '@backendkit-labs/retry/nestjs';

@Injectable()
export class MyService {
  constructor(
    @Inject(RETRY_ENGINE_TOKEN)    private engine:   RetryEngine,
    @Inject(RETRY_REGISTRY_TOKEN)  private registry: RetryRegistry,
  ) {}
}
```

## Architecture

```
@backendkit-labs/retry          (core — no framework deps)
  retry()                       standalone function, global registry
  RetryEngine                   stateful engine with integrations
  RetryRegistry                 named engine instances

@backendkit-labs/retry/nestjs   (optional NestJS layer)
  RetryModule                   RetryModule.forRoot(options)
  RetryService                  injectable execute()
  @Retry                        method decorator
  RetryInterceptor              intercepts @Retry-decorated methods
  RETRY_ENGINE_TOKEN            DI token for RetryEngine
  RETRY_REGISTRY_TOKEN          DI token for RetryRegistry
```
