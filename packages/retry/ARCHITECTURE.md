# Architecture: @backendkit-labs/retry

> Design document for the retry library — enterprise-grade, zero external dependencies,
> deeply integrated with the BackendKit Labs ecosystem (@backendkit-labs/result,
> @backendkit-labs/circuit-breaker, @backendkit-labs/bulkhead, @backendkit-labs/observability,
> @backendkit-labs/http-client).

---

## Table of Contents

1. [Directory Structure](#1-directory-structure)
2. [Architecture Diagram](#2-architecture-diagram)
3. [Decision Flowchart](#3-decision-flowchart)
4. [Core Interfaces](#4-core-interfaces)
5. [Integration Strategy](#5-integration-strategy)
6. [Testing Strategy](#6-testing-strategy)
7. [Implementation Plan](#7-implementation-plan)
8. [Trade-offs & Decisions](#8-trade-offs--decisions)

---

## 1. Directory Structure

```
packages/Retry/
+-- src/
|   +-- index.ts                  # Public barrel export
|   +-- Retry/
|   |   +-- index.ts
|   |   +-- Retry.engine.ts       # RetryEngine class (main public API)
|   |   +-- Retry.executor.ts     # AgainExecutor (orchestrator loop)
|   |   +-- Retry.registry.ts     # RetryRegistry (named config cache)
|   |   +-- Retry.budget.ts       # SlidingWindowBudget
|   |   +-- Retry.errors.ts       # RetryExhaustedError, BudgetExhaustedError, etc.
|   |   +-- Retry.hooks.ts        # Hook types + HookRunner
|   |   +-- types.ts              # All public interfaces & config types
|   +-- backoff/
|   |   +-- index.ts
|   |   +-- backoff.strategy.ts   # BackoffStrategy interface
|   |   +-- fixed.backoff.ts      # FixedBackoff
|   |   +-- linear.backoff.ts     # LinearBackoff
|   |   +-- exponential.backoff.ts# ExponentialBackoff (+ jitter decorator)
|   |   +-- jitter.decorator.ts   # JitterDecorator (wraps any strategy)
|   +-- conditions/
|   |   +-- index.ts
|   |   +-- Retry.condition.ts    # RetryCondition interface
|   |   +-- abort.condition.ts    # AbortCondition interface
|   |   +-- http.conditions.ts    # Presets: isRetryableHttpError, isAbortableHttpError
|   |   +-- error.classifier.ts   # DefaultErrorClassifier
|   +-- timeout/
|   |   +-- index.ts
|   |   +-- timeout.manager.ts    # TimeoutManager
|   +-- idempotency/
|   |   +-- index.ts
|   |   +-- idempotency.store.ts  # IdempotencyStore interface
|   |   +-- memory.store.ts       # InMemoryIdempotencyStore
|   |   +-- idempotency.manager.ts# IdempotencyManager
|   +-- nestjs/
|   |   +-- index.ts
|   |   +-- Retry.module.ts
|   |   +-- Retry.decorator.ts    # @Retry
|   |   +-- Retry.interceptor.ts  # RetryInterceptor
|   |   +-- Retry.service.ts      # RetryService (DI wrapper)
|   |   +-- Retry.constants.ts    # DI tokens
+-- tests/
|   +-- unit/
|   |   +-- backoff/
|   |   +-- conditions/
|   |   +-- Retry.executor.spec.ts
|   |   +-- Retry.budget.spec.ts
|   +-- integration/
|   |   +-- circuit-breaker.spec.ts
|   |   +-- bulkhead.spec.ts
|   |   +-- observability.spec.ts
|   +-- resilience/
|       +-- chaos.spec.ts
+-- package.json
+-- tsconfig.json
+-- tsup.config.ts
```

---

## 2. Architecture Diagram

```
                           +-----------+
                           |   User    |
                           |  Code     |
                           +-----+-----+
                                 |
                    +------------+-------------+
                    |            |             |
            +-------v---+ +----v-----+ +------v------+
            | Retry()  | | @Retry   | | AgainInter- |
            | function | | decorator| | ceptor      |
            +-----+-----+ +----+-----+ +------+------+
                  |              |              |
                  +--------------+--------------+
                                 |
                    +------------v-------------+
                    |      RetryEngine         |
                    |  (config + execute<T>)   |
                    +------------+-------------+
                                 |
                    +------------v-------------+
                    |      AgainExecutor       |
                    |  (loop orchestrator)     |
                    +--+-------+-------+---+---+
                       |       |       |   |
              +--------v+  +---v---+ +-v--+ +v-----------+
              |Backoff  |  |Budget | |Time| |Idempotency |
              |Strategy |  |       | |out | |Manager     |
              +---------+  +-------+ +----+ +------------+
                       |       |       |
              +--------v+  +---v---+ +-v--+
              |Error    |  |Retry  | |Abort|
              |Classifi-|  |Cond.  | |Cond |
              |er       |  |       | |     |
              +---------+  +-------+ +----+

    External integrations (optional, duck-typed at runtime):
    +------------------+  +-------------+  +------------------+
    | @backendkit-labs |  | @backendkit |  | @backendkit-labs |
    | /circuit-breaker |  | -labs/      |  | /observability   |
    | (check state     |  | bulkhead    |  | (logs, metrics,  |
    |  before retry)   |  | (acquire    |  |  events, traces) |
    +------------------+  +-------------+  +------------------+
```

---

## 3. Decision Flowchart

```
                    START
                      |
                      v
              +----------------+
              | Budget record  |
              | Call()         |
              +-------+--------+
                      |
                      v
              +----------------+
              | Execute task   |
              | (timeout per   |
              |  attempt)      |
              +-------+--------+
                      |
            +---------+----------+
            |                    |
          SUCCESS              ERROR
            |                    |
            v                    v
    +----------------+   +----------------------+
    | Budget record  |   | Classify error       |
    | Success()      |   | (transient/permanent)|
    +-------+--------+   +----------+-----------+
            |                       |
            v                       |
    +----------------+     +--------+--------+
    | Return ok(T)   |     |                 |
    +----------------+   PERMANENT       TRANSIENT
                              |               |
                              v               v
                     +----------------+  +------------------+
                     | Check abort    |  | Check retry      |
                     | condition      |  | condition        |
                     +-------+--------+  +--------+---------+
                             |                    |
                       +-----+------+      +------+-------+
                       |            |      |              |
                     ABORT        OK    RETRYABLE     NOT RETRYABLE
                       |            |      |              |
                       v            v      v              v
                +-----------+  +------+ +----------+ +----------+
                | Return    |  | Next | | Attempt  | | Attempts |
                | err() or  |  |hook  | | <= max?  | | exhausted|
                | fallback  |  +------+ +----+-----+ +-----+----+
                +-----------+       |        |             |
                                    v        v             v
                              +---------+ +------+  +-----------+
                              | Fire    | | YES  |  | Fire      |
                              | onRetry | |  +---+  | onExhaus- |
                              | event   | |  |      | ted event |
                              +---------+ |  |      +-----+-----+
                                          |  |            |
                                          v  v            v
                                    +------------+   +--------+
                                    | Compute    |   | Return |
                                    | delay &    |   | err()  |
                                    | wait       |   | or     |
                                    +-----+------+   |fallback|
                                          |           +--------+
                                          v
                                     (loop back to
                                      Execute task)
```

---

## 4. Core Interfaces

### 4.1 RetryEngine (main public API)

```typescript
// src/Retry/Retry.engine.ts

export class RetryEngine {
  constructor(private config: RetryEngineConfig) {}

  /**
   * Execute a task with retry logic.
   * Returns Result<T, RetryError> — never throws.
   */
  async execute<T>(
    task: () => Promise<T>,
    options?: Partial<RetryConfig>,
  ): Promise<Result<T, RetryError>> { ... }

  /**
   * Execute with a typed correlation ID for observability.
   */
  async executeWithContext<T>(
    task: () => Promise<T>,
    context: { correlationId?: string },
    options?: Partial<RetryConfig>,
  ): Promise<Result<T, RetryError>> { ... }

  /** Update engine-level defaults at runtime. */
  updateDefaults(partial: Partial<RetryConfig>): void { ... }

  /** Get current metrics. */
  getMetrics(): RetryMetricsSnapshot { ... }

  /** Reset metrics counters. */
  resetMetrics(): void { ... }
}
```

### 4.2 RetryConfig (complete)

```typescript
// src/Retry/types.ts

// ---- Backoff ----

export type JitterType = 'full' | 'equal' | 'decorrelated';

export interface BackoffStrategy {
  /** Compute delay in ms for attempt number (1-based). */
  nextDelay(attempt: number): number;
  /** Reset internal state (for stateful strategies like decorrelated jitter). */
  reset(): void;
  /** Deep clone with optional overrides. */
  clone(overrides?: Partial<BackoffConfig>): BackoffStrategy;
}

export type BackoffConfig =
  | { type: 'fixed';     baseDelay: number }
  | { type: 'linear';    baseDelay: number; multiplier?: number; maxDelay?: number }
  | { type: 'exponential'; baseDelay: number; multiplier?: number; maxDelay?: number; jitter?: JitterType };

// ---- Conditions ----

export interface RetryCondition {
  shouldRetry(error: RetryErrorPayload): boolean | Promise<boolean>;
}

export interface AbortCondition {
  shouldAbort(error: RetryErrorPayload): boolean | Promise<boolean>;
}

export type RetryConditionFn = (error: RetryErrorPayload) => boolean | Promise<boolean>;
export type AbortConditionFn = (error: RetryErrorPayload) => boolean | Promise<boolean>;

// ---- Error Classification ----

export interface ClassifierRule {
  name: string;
  priority?: number;         // Lower = evaluated first. Default: 100
  match: (error: RetryErrorPayload) => boolean;
  classification: ErrorClassification;
}

export type ErrorClassification = 'transient' | 'permanent';

// ---- Budget ----

export interface RetryBudgetConfig {
  windowMs: number;          // sliding window duration. Default: 60_000
  maxRetryRatio: number;     // 0.0-1.0. Default: 0.1 (10%)
  minRequestCount: number;   // min calls before budget enforced. Default: 10
}

// ---- Timeout ----

export interface TimeoutConfig {
  globalTimeoutMs: number;   // total retry operation timeout. Default: 0 (unlimited)
  attemptTimeoutMs: number;  // per-attempt timeout. Default: 0 (unlimited)
}

// ---- Idempotency ----

export interface IdempotencyStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlMs?: number): Promise<void>;
  exists(key: string): Promise<boolean>;
}

export interface IdempotencyConfig {
  enabled: boolean;                  // Default: false
  store?: IdempotencyStore;          // Default: InMemoryIdempotencyStore
  idempotentMethods: string[];       // Default: ['POST', 'PUT', 'PATCH']
  headerName: string;                // Default: 'Idempotency-Key'
  ttlMs: number;                     // Default: 24h
}

// ---- Hooks / Events ----

export interface RetryHooks {
  beforeRetry?:        (ctx: BeforeRetryContext) => void | Promise<void>;
  afterRetry?:         (ctx: AfterRetryContext) => void | Promise<void>;
  onRetrySuccess?:     (ctx: RetrySuccessContext) => void | Promise<void>;
  onExhausted?:        (ctx: ExhaustedContext) => void | Promise<void>;
  onBudgetExhausted?:  (ctx: BudgetExhaustedContext) => void | Promise<void>;
}

export interface BeforeRetryContext {
  attempt: number;
  error: RetryErrorPayload;
  delayMs: number;
  correlationId?: string;
}

export interface AfterRetryContext {
  attempt: number;
  error: RetryErrorPayload;
  delayMs: number;
  correlationId?: string;
}

export interface RetrySuccessContext {
  attempt: number;
  totalAttempts: number;
  totalElapsedMs: number;
  correlationId?: string;
}

export interface ExhaustedContext {
  lastError: RetryErrorPayload;
  totalAttempts: number;
  totalElapsedMs: number;
  correlationId?: string;
}

export interface BudgetExhaustedContext {
  correlationId?: string;
}

// ---- Error Types ----

export interface RetryErrorPayload {
  type: ErrorType;
  message: string;
  status?: number;
  cause?: unknown;
  attempt: number;
  elapsedMs: number;
}

export type ErrorType =
  | 'http'             // HTTP error with status code
  | 'network'          // DNS, connection refused, ECONNRESET
  | 'timeout'          // Per-attempt or global timeout
  | 'circuit-open'     // Circuit breaker is OPEN
  | 'bulkhead-rejected'// Bulkhead rejected the call
  | 'business'         // Business/validation error (classified permanent)
  | 'unknown';

export interface RetryMetadata {
  attempts: number;
  totalElapsedMs: number;
  lastError?: RetryErrorPayload;
  budgetExhausted?: boolean;
  circuitOpen?: boolean;
}

export type RetryError = RetryErrorPayload & { metadata: RetryMetadata };

// ---- Main Config ----

export interface RetryConfig {
  maxAttempts: number;                       // Default: 3
  backoff: BackoffConfig | BackoffStrategy;  // Default: exponential
  retryIf?: RetryCondition | RetryConditionFn;
  abortIf?: AbortCondition | AbortConditionFn;
  timeout?: Partial<TimeoutConfig>;
  budget?: Partial<RetryBudgetConfig>;
  idempotency?: Partial<IdempotencyConfig>;
  classifiers?: ClassifierRule[];
  /** Dynamic delay based on error (overrides backoff). */
  dynamicDelay?: (error: RetryErrorPayload, attempt: number) => number;
  hooks?: RetryHooks;
  /** Fallback value/function when retries exhausted. */
  fallback?: (error: RetryErrorPayload) => unknown | Promise<unknown>;
  correlationId?: string;
}

export interface RetryEngineConfig {
  name: string;
  /** Reference to registry (optional, for shared config across services). */
  registry?: RetryRegistry;
  /** Default config applied to all execute() calls. */
  defaultConfig?: Partial<RetryConfig>;
  /** External integrations (optional — duck-typed at runtime). */
  integrations?: {
    circuitBreaker?: CircuitBreakerLike;
    bulkhead?: BulkheadLike;
    observability?: {
      logger?: BkLoggerLike;
      metrics?: MetricsEmitterLike;
    };
  };
}

// ---- Duck-typed integration contracts ----

export interface CircuitBreakerLike {
  canAttempt(): boolean;
  onSuccess(durationMs: number): void;
  onError(error: unknown): void;
  getState(): unknown;
}

export interface BulkheadLike {
  execute<T>(fn: () => Promise<T>): Promise<T>;
  isFull(): boolean;
}

export interface BkLoggerLike {
  info(msg: string, meta?: unknown): void;
  warn(msg: string, meta?: unknown): void;
  error(msg: string, meta?: unknown): void;
}

export interface MetricsEmitterLike {
  emit(event: MetricEvent): void;
}

export interface MetricEvent {
  name: string;
  value: number;
  tags?: Record<string, string | number>;
}
```

### 4.3 Registry

```typescript
// src/Retry/Retry.registry.ts

export class RetryRegistry {
  private readonly engines = new Map<string, RetryEngine>();

  getOrCreate(name: string, config?: Partial<RetryEngineConfig>): RetryEngine {
    if (!this.engines.has(name)) {
      this.engines.set(name, new RetryEngine({
        name,
        ...config,
        defaultConfig: { ...config?.defaultConfig },
        integrations: config?.integrations,
      }));
    }
    return this.engines.get(name)!;
  }

  get(name: string): RetryEngine | undefined {
    return this.engines.get(name);
  }

  reset(name: string): void {
    this.engines.delete(name);
  }

  resetAll(): void {
    this.engines.clear();
  }

  getAllMetrics(): Record<string, RetryMetricsSnapshot> {
    const metrics: Record<string, RetryMetricsSnapshot> = {};
    for (const [name, engine] of this.engines) {
      metrics[name] = engine.getMetrics();
    }
    return metrics;
  }
}
```

### 4.4 AgainExecutor (orchestrator — internal)

```typescript
// src/Retry/Retry.executor.ts
// Not exported. Consumed by RetryEngine.execute().

interface ExecutorDependencies {
  backoff: BackoffStrategy;
  budget?: SlidingWindowBudget;
  classifier: DefaultErrorClassifier;
  timeoutManager: TimeoutManager;
  idempotency?: IdempotencyManager;
  RetryCondition: RetryCondition;
  abortCondition: AbortCondition;
  hooks: HookRunner;
  integrations?: RetryEngineConfig['integrations'];
  correlationId?: string;
}

class AgainExecutor {
  constructor(private deps: ExecutorDependencies, private config: RetryConfig) {}

  async run<T>(task: () => Promise<T>): Promise<Result<T, RetryError>> {
    // 1. Budget: recordCall()
    // 2. Check circuit breaker (if available) — fail fast if OPEN
    // 3. Loop: attempt 1..maxAttempts
    //    a. Check global timeout → abort
    //    b. Compute delay + sleep (skip on 1st attempt)
    //    c. Acquire bulkhead slot (if available)
    //    d. Execute task with attempt timeout
    //    e. Classify error:
    //       - success → record budget success, fire onRetrySuccess, return ok
    //       - permanent → fire abort, check fallback, return err
    //       - transient → check Retry condition
    //         - retryable → budget record failure, fire beforeRetry, loop
    //         - not retryable (or maxAttempts) → fire onExhausted, check fallback, return err
    // 4. Circuit breaker: report success/failure after each attempt
  }
}
```

### 4.5 Budget

```typescript
// src/Retry/Retry.budget.ts

export interface SlidingWindowBudget {
  tryConsume(): boolean;
  recordSuccess(): void;
  recordFailure(): void;
  recordCall(): void;
  getMetrics(): BudgetMetrics;
}

export interface BudgetMetrics {
  allowed: boolean;
  retryCount: number;
  successCount: number;
  failureCount: number;
  totalCalls: number;
  currentRatio: number;
}
```

### 4.6 Error classifier

```typescript
// src/conditions/error.classifier.ts

export class DefaultErrorClassifier {
  constructor(rules?: ClassifierRule[]);

  classify(error: RetryErrorPayload): ErrorClassification;

  // Built-in rules (highest priority first):
  //   401, 403, 404, 422, 400, 413 → permanent
  //   429, 5xx, network, timeout → transient
  //   circuit-open, bulkhead-rejected → transient
  //   fallback → permanent
  // Custom rules injected before fallback, after built-in defaults.
}
```

### 4.7 Hooks wrapper

```typescript
// src/Retry/Retry.hooks.ts

export class HookRunner {
  constructor(private hooks: RetryHooks, private correlationId?: string);

  async beforeRetry(ctx: BeforeRetryContext): Promise<void>;
  async afterRetry(ctx: AfterRetryContext): Promise<void>;
  async onRetrySuccess(ctx: RetrySuccessContext): Promise<void>;
  async onExhausted(ctx: ExhaustedContext): Promise<void>;
  async onBudgetExhausted(): Promise<void>;

  // All methods are safe: errors in hooks are logged but never propagated.
  // This prevents a broken hook from corrupting the retry state.
}
```

---

## 5. Integration Strategy

### 5.1 With @backendkit-labs/circuit-breaker

```typescript
// Integration: optional, detected at runtime via duck-typing (CircuitBreakerLike).
// No import needed in the core — the user passes the CB instance via config.

// Inside AgainExecutor.run():
// 1. Before retry loop:
//    if (circuitBreaker && !circuitBreaker.canAttempt()) {
//      // Circuit is OPEN — fail fast
//      return err({ type: 'circuit-open', ... });
//    }
//
// 2. After each attempt:
//    if (circuitBreaker) {
//      if (success) {
//        circuitBreaker.onSuccess(durationMs);
//      } else if (classification === 'transient') {
//        circuitBreaker.onError(error);  // infrastructure error
//      }
//      // Permanent/business errors: transparent to CB (not recorded)
//    }
```

**Integration contract (duck-typed, defined in types.ts):**

```typescript
export interface CircuitBreakerLike {
  canAttempt(): boolean;
  onSuccess(durationMs: number): void;
  onError(error: unknown): void;
  getState(): unknown;
}
```

### 5.2 With @backendkit-labs/bulkhead

```typescript
// Inside AgainExecutor.run():
// 1. Before each attempt, acquire bulkhead slot
//    try {
//      const result = await bulkhead.execute(task);
//    } catch (e) {
//      if (e instanceof BulkheadRejectedError) {
//        // Bulkhead full — wait (with backoff) and retry
//      }
//    }
//
// When bulkhead rejects, the error is classified as 'transient' with
// type 'bulkhead-rejected' → triggers another retry with backoff.
```

**Integration contract (duck-typed):**

```typescript
export interface BulkheadLike {
  execute<T>(fn: () => Promise<T>): Promise<T>;
  isFull(): boolean;
}
```

### 5.3 With @backendkit-labs/observability

```typescript
// Inside AgainExecutor, at each lifecycle point:

// Logs (via BkLoggerLike.warn):
// 1. beforeRetry → warn("Retry: retrying", { attempt, delayMs, error, correlationId })
// 2. onExhausted → error("Retry: exhausted", { attempts, error, correlationId })

// Metrics (via MetricsEmitterLike.emit):
// 1. after retry → emit({ name: 'Retry.attempt', value: 1, tags: { engine, attempt, error_type } })
// 2. on success → emit({ name: 'Retry.success', value: 1, tags: { engine, attempts } })
// 3. on exhausted → emit({ name: 'Retry.exhausted', value: 1, tags: { engine, error_type } })
// 4. on budget exhausted → emit({ name: 'Retry.budget_exhausted', value: 1, tags: { engine } })
```

**Integration contracts (duck-typed):**

```typescript
export interface BkLoggerLike {
  info(msg: string, meta?: unknown): void;
  warn(msg: string, meta?: unknown): void;
  error(msg: string, meta?: unknown): void;
}

export interface MetricsEmitterLike {
  emit(event: MetricEvent): void;
}

export interface MetricEvent {
  name: string;
  value: number;
  tags?: Record<string, string | number>;
}
```

### 5.4 With @backendkit-labs/result

```typescript
// All public APIs return Result<T, RetryError>.
// - On success: ok(value)
// - On exhausted: err(error)
// - On abort: err(error)
// - On budget exhausted: err(error)
// - Fallback: ok(fallbackValue)

// Usage:
import { ok, err } from '@backendkit-labs/result';
import { Retry } from '@backendkit-labs/retry';

const result = await retry(() => fetchUser(id), { maxAttempts: 3 });
result.match(
  (user) => res.json(user),
  (error) => {
    if (error.type === 'timeout') return res.status(504).json({ error: 'gateway timeout' });
    return res.status(502).json({ error: error.message });
  },
);
```

### 5.5 With @backendkit-labs/http-client

```typescript
// The http-client already has an internal RetryConfig:
//   { attempts: number; delayMs?: number; maxDelayMs?: number; jitter?: boolean; shouldRetry?: fn }
//
// @backendkit-labs/retry supersedes that internal retry. Migration path:
// 1. Keep http-client's RetryConfig for backward compat
// 2. Document that users should use @backendkit-labs/retry for advanced cases
// 3. http-client can optionally accept an RetryEngine instance

// http-client integration:
import { RetryRegistry } from '@backendkit-labs/retry';

const httpClient = new HttpClient({
  baseURL: 'https://api.example.com',
  RetryEngine: RetryRegistry.getOrCreate('http-api'),
});
```

---

## 6. Testing Strategy

### 6.1 Unit Tests

```
tests/unit/
+-- backoff/
|   +-- fixed.backoff.spec.ts
|   +-- linear.backoff.spec.ts
|   +-- exponential.backoff.spec.ts
|   +-- jitter.decorator.spec.ts
+-- conditions/
|   +-- http.conditions.spec.ts
|   +-- error.classifier.spec.ts
+-- Retry.budget.spec.ts
+-- Retry.executor.spec.ts
+-- timeout.manager.spec.ts
+-- idempotency.manager.spec.ts
```

Key test scenarios per component:

| Component | What to test |
|---|---|
| Backoff strategies | Correct delay values, boundaries (0, maxDelay), jitter distribution |
| Error classifier | All built-in rules, custom rules with priority, edge cases |
| SlidingWindowBudget | Ratio enforcement, window sliding, token exhaustion, refill |
| TimeoutManager | Global timeout abort, per-attempt timeout, remaining time calc |
| AgainExecutor | Full loop: success, exhausted, abort, budget exhausted, fallback |
| IdempotencyManager | Key generation, store operations, TTL, concurrency |

### 6.2 Integration Tests

```
tests/integration/
+-- circuit-breaker.spec.ts     # CB state check before retry, CB reporting
+-- bulkhead.spec.ts            # Bulkhead acquisition per attempt
+-- observability.spec.ts       # Log calls, metric emissions, hook chain
+-- result.spec.ts              # ok/err types flow correctly through retry
```

### 6.3 Resilience Tests (Chaos)

```
tests/resilience/
+-- chaos.spec.ts
```

| Test | What it simulates |
|---|---|
| `flaky network` | Intermittent ECONNRESET — verify backoff + success |
| `slow endpoint` | Response > attemptTimeout — verify retry on timeout |
| `dead endpoint` | All calls fail — verify exhaustion + fallback |
| `burst 429 + recover` | 10x 429 then 200 — verify budget + backoff |
| `circuit opens mid-retry` | CB OPEN after 2nd attempt — verify fail fast |
| `bulkhead full` | Bulkhead rejects — verify backoff + retry |

---

## 7. Implementation Plan

### Phase 1: MVP (core retry loop + essential backoff)

**Goal:** Working retry with exponential backoff, conditions, hooks, Result return.

| Step | Files | Est. |
|---|---|---|
| 1.1 | Package scaffold: `package.json`, `tsconfig.json`, `tsup.config.ts` | 1h |
| 1.2 | `BackoffStrategy` interface + `ExponentialBackoff` + `FixedBackoff` | 2h |
| 1.3 | `RetryCondition`, `AbortCondition` interfaces + `http.conditions.ts` | 1h |
| 1.4 | `RetryErrorPayload`, `ErrorType`, `RetryConfig` types | 1h |
| 1.5 | `TimeoutManager` (global + per-attempt) | 2h |
| 1.6 | `AgainExecutor` (core loop with conditions, timeout, hooks) | 4h |
| 1.7 | `RetryEngine` (public `execute<T>()` API with Result) | 2h |
| 1.8 | `Retry()` standalone function | 1h |
| 1.9 | Unit tests for executor + backoff + conditions | 3h |

**Total MVP:** ~17h

### Phase 2: Budget + LinearBackoff + Jitter

| Step | Files | Est. |
|---|---|---|
| 2.1 | `LinearBackoff` | 1h |
| 2.2 | `JitterDecorator` (wraps any strategy) | 2h |
| 2.3 | `SlidingWindowBudget` + tests | 4h |
| 2.4 | Budget integration in executor | 2h |
| 2.5 | Integration tests with budget | 2h |

**Total Phase 2:** ~11h

### Phase 3: Error Classification + Dynamic Delay + Fallback

| Step | Files | Est. |
|---|---|---|
| 3.1 | `DefaultErrorClassifier` with rules engine | 3h |
| 3.2 | `dynamicDelay` config + integration in executor | 2h |
| 3.3 | `fallback` support in executor | 2h |
| 3.4 | `RetryExhaustedError`, `BudgetExhaustedError` | 1h |
| 3.5 | `HookRunner` (safe async hooks with error swallowing) | 2h |
| 3.6 | Unit tests for classifier + fallback | 2h |

**Total Phase 3:** ~12h

### Phase 4: Integrations (CB, Bulkhead, Observability)

| Step | Files | Est. |
|---|---|---|
| 4.1 | Circuit breaker integration (duck-typed check + report) | 3h |
| 4.2 | Bulkhead integration (acquire slot per attempt) | 2h |
| 4.3 | Observability integration (logs + metrics events) | 3h |
| 4.4 | `RetryRegistry` | 1h |
| 4.5 | Integration tests (CB + bulkhead + obs) | 4h |
| 4.6 | Chaos resilience tests | 4h |

**Total Phase 4:** ~17h

### Phase 5: Idempotency + NestJS Integration

| Step | Files | Est. |
|---|---|---|
| 5.1 | `IdempotencyStore` interface + `InMemoryIdempotencyStore` | 2h |
| 5.2 | `IdempotencyManager` (key gen, header injection) | 2h |
| 5.3 | NestJS `RetryModule`, `RetryService` | 2h |
| 5.4 | `@Retry` decorator (method-level) | 2h |
| 5.5 | `RetryInterceptor` (controller-level) | 2h |
| 5.6 | NestJS integration tests | 2h |

**Total Phase 5:** ~12h

### Phase 6: GA (docs, benchmarks, examples, final polish)

| Step | Est. |
|---|---|
| README with examples | 2h |
| API docs generation | 1h |
| Benchmarks (vs manual retry, vs other libs) | 3h |
| Performance profiling, memory leaks check | 2h |
| Review: naming consistency with ecosystem | 2h |

**Total Phase 6:** ~10h

**Overall estimate:** ~79h (10 working days)

---

## 8. Trade-offs & Decisions

### Decision 1: Class-based RetryEngine over pure function

```typescript
// Chosen:
const engine = new RetryEngine({ name: 'http-api' });
const result = await engine.execute(task, { maxAttempts: 3 });

// Alternative considered: pure function with config object
const result = await retry(task, { maxAttempts: 3 });
```

**Why:** Class enables stateful metrics, named instances via registry, runtime config
updates, and integration injection (CB, bulkhead). The standalone `Retry()` function
is provided as sugar on top of a global RetryRegistry.

**Trade-off:** Slightly heavier API. Mitigated by offering both: `Retry()` for simple
cases, `RetryEngine` for advanced.

---

### Decision 2: Duck-typed integrations over peer dependency imports

```typescript
// Chosen:
interface CircuitBreakerLike { canAttempt(): boolean; ... }
// Internal executor checks: circuitBreaker?.canAttempt()

// Alternative: import CircuitBreaker class directly
import { CircuitBreaker } from '@backendkit-labs/circuit-breaker';
if (circuitBreaker instanceof CircuitBreaker) { ... }
```

**Why:** Zero peer dependencies. The library works standalone. Integrations are
pluggable at runtime — pass any object that quacks like a CircuitBreaker.
This also makes testing trivial: pass a mock.

**Trade-off:** No compile-time safety for the integration contract. Mitigated by
documenting the expected interface clearly and providing factory helpers.

---

### Decision 3: Sliding window budget over token bucket

```typescript
// Chosen:
class SlidingWindowBudget {
  private window: Array<{ type: 'call' | 'retry'; timestamp: number }>;
}

// Alternative: Token bucket with fixed refill rate
class TokenBucketBudget {
  private tokens: number;
}
```

**Why:** Sliding window is more accurate for microservice retry budgets — it
reflects actual request ratios in the recent window, not an abstract token rate.
A 429 response means "slow down," and the sliding window adapts faster than a
token bucket with constant refill.

**Trade-off:** Slightly more memory (window array). Mitigated by configurable
window size and automatic eviction of old entries.

---

### Decision 4: Backoff strategies as composable strategies, not enums

```typescript
// Chosen:
const backoff = new ExponentialBackoff({ baseDelay: 200 });
const withJitter = new JitterDecorator(backoff, 'full');

// Alternative:
const config = { type: 'exponential', delay: 200, jitter: true };
```

**Why:** Strategy pattern enables composition (exponential + jitter, linear + jitter,
custom strategies). The config object syntax is sugar that constructs the strategy
internally. Both work.

**Trade-off:** More classes. Mitigated by the config shorthand: `backoff: { type: 'exponential', jitter: 'full' }` works too.

---

### Decision 5: Hooks swallow errors silently

```typescript
// Chosen:
try { await this.hooks.beforeRetry(ctx); } catch { /* logged, not propagated */ }
```

**Why:** A broken hook must never corrupt the retry state or lose data. If the
user's `beforeRetry` throws, the retry loop continues normally. The error is
logged via the observability integration if available.

**Trade-off:** Bugs in hooks are silent. Mitigated by logging the hook error.

---

### Decision 6: Timeout per attempt vs global timeout only

Both are provided:

```typescript
const result = await retry(task, {
  timeout: {
    attemptTimeoutMs: 5_000,   // each try has 5s
    globalTimeoutMs: 30_000,   // total operation capped at 30s
  },
});
```

**Why:** Per-attempt timeout lets you retry fast individual failures. Global
timeout prevents the entire operation from running indefinitely. Both are
independent — attempt timeout expiration triggers retry (if retryable),
global timeout expiration triggers abort.

---

### Decision 7: Not including a RetryQueue (deferred retry)

Explicitly excluded from MVP. Deferred retry (retry "later" via a background
queue) adds significant complexity (persistence, scheduling, concurrency).
If needed, it's a separate concern — potentially a new package
`@backendkit-labs/retry-queue` built on top of this one.

---

## Summary: API Surface (all public exports)

```typescript
// Core
export { RetryEngine } from './retry/retry.engine.js';
export { RetryRegistry } from './retry/retry.registry.js';
export { retry } from './retry/retry.fn.js';   // standalone sugar

// Config
export type {
  RetryConfig, RetryEngineConfig,
  BackoffConfig, BackoffStrategy, JitterType,
  RetryCondition, AbortCondition, RetryConditionFn, AbortConditionFn,
  RetryBudgetConfig, SlidingWindowBudget, BudgetMetrics,
  TimeoutConfig,
  IdempotencyConfig, IdempotencyStore,
  ClassifierRule, ErrorClassification,
  RetryHooks,
  BeforeRetryContext, AfterRetryContext,
  RetrySuccessContext, ExhaustedContext, BudgetExhaustedContext,
  RetryErrorPayload, RetryError, ErrorType, RetryMetadata,
  RetryMetricsSnapshot,
  CircuitBreakerLike, BulkheadLike, BkLoggerLike, MetricsEmitterLike,
} from './retry/types.js';

// Backoff strategies
export { FixedBackoff } from './backoff/fixed.backoff.js';
export { LinearBackoff } from './backoff/linear.backoff.js';
export { ExponentialBackoff } from './backoff/exponential.backoff.js';
export { JitterDecorator, applyJitter } from './backoff/jitter.decorator.js';

// Conditions
export { defaultRetryCondition, defaultAbortCondition } from './conditions/http.conditions.js';
export { DefaultErrorClassifier } from './conditions/error.classifier.js';

// Budget
export { SlidingWindowBudget } from './retry/retry.budget.js';

// Timeout
export { TimeoutManager } from './timeout/timeout.manager.js';
export { AttemptTimeoutError, GlobalTimeoutError } from './timeout/timeout.errors.js';

// Idempotency
export { IdempotencyManager } from './idempotency/idempotency.manager.js';
export { InMemoryIdempotencyStore } from './idempotency/memory.store.js';

// Errors
export { RetryExhaustedError, BudgetExhaustedError } from './retry/retry.errors.js';

// NestJS (subpath: @backendkit-labs/retry/nestjs)
export { RetryModule } from './nestjs/Retry.module.js';
export { Retry } from './nestjs/Retry.decorator.js';
export { RetryInterceptor } from './nestjs/Retry.interceptor.js';
export { RetryService } from './nestjs/Retry.service.js';
export { RETRY_ENGINE_TOKEN, RETRY_REGISTRY_TOKEN } from './nestjs/Retry.constants.js';
```

[memory:decision] Class-based RetryEngine with duck-typed integrations — permite composicion sin peer dependencies, es testable con mocks, y ofrece tanto API simple (Retry()) como avanzada (RetryEngine + Registry)
