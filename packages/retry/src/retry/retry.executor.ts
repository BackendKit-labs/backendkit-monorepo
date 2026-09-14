import { ok, fail, type Result } from '@backendkit-labs/result';
import type {
  RetryConfig,
  RetryError,
  RetryErrorPayload,
  BackoffStrategy,
  RetryCondition,
  AbortCondition,
  CircuitBreakerLike,
  BulkheadLike,
  BkLoggerLike,
  MetricsEmitterLike,
} from './types.js';
import type { SlidingWindowBudget } from './retry.budget.js';
import type { DefaultErrorClassifier } from '../conditions/error.classifier.js';
import type { TimeoutManager } from '../timeout/timeout.manager.js';
import type { IdempotencyManager } from '../idempotency/idempotency.manager.js';
import { HookRunner } from './retry.hooks.js';
import { AttemptTimeoutError, GlobalTimeoutError } from '../timeout/timeout.errors.js';

export interface ExecutorDependencies {
  backoff: BackoffStrategy;
  budget?: SlidingWindowBudget;
  classifier: DefaultErrorClassifier;
  timeoutManager: TimeoutManager;
  idempotency?: IdempotencyManager;
  RetryCondition: RetryCondition;
  abortCondition: AbortCondition;
  hooks: HookRunner;
  circuitBreaker?: CircuitBreakerLike;
  bulkhead?: BulkheadLike;
  logger?: BkLoggerLike;
  metrics?: MetricsEmitterLike;
  correlationId?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const NETWORK_CODES = new Set([
  'ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT',
  'EAI_AGAIN', 'ECONNABORTED', 'EPIPE',
  'ERR_NETWORK', // axios, no response received
]);

function getHttpStatus(err: unknown): number | undefined {
  if (err == null || typeof err !== 'object') return undefined;
  const e = err as Record<string, unknown>;
  if (typeof e['status'] === 'number') return e['status'];
  if (typeof e['statusCode'] === 'number') return e['statusCode'];
  if (typeof e['getStatus'] === 'function') {
    const status = (e['getStatus'] as () => unknown)();
    if (typeof status === 'number') return status;
  }
  const response = e['response'];
  if (response != null && typeof response === 'object') {
    const r = response as Record<string, unknown>;
    if (typeof r['status'] === 'number') return r['status'];
  }
  return undefined;
}

/**
 * Reads `.code`, falling back to `.cause.code` -- native `fetch()` wraps the
 * real network error (e.g. `ECONNREFUSED`) in `TypeError('fetch failed', { cause })`.
 */
function getErrorCode(err: unknown): string | undefined {
  if (err == null || typeof err !== 'object') return undefined;
  const e = err as Record<string, unknown>;
  if (typeof e['code'] === 'string') return e['code'];
  const cause = e['cause'];
  if (cause != null && typeof cause === 'object') {
    const causeCode = (cause as Record<string, unknown>)['code'];
    if (typeof causeCode === 'string') return causeCode;
  }
  return undefined;
}

function normalizeError(err: unknown, attempt: number, startTime: number): RetryErrorPayload {
  const elapsedMs = Date.now() - startTime;

  if (err instanceof AttemptTimeoutError || err instanceof GlobalTimeoutError) {
    return { type: 'timeout', message: err.message, attempt, elapsedMs, cause: err };
  }

  const status = getHttpStatus(err);
  if (status !== undefined) {
    const message = err instanceof Error ? err.message : `HTTP ${status}`;
    return { type: 'http', message, status, attempt, elapsedMs, cause: err };
  }

  const code = getErrorCode(err);
  if (code !== undefined && NETWORK_CODES.has(code)) {
    const message = err instanceof Error ? err.message : 'Network error';
    return { type: 'network', message, attempt, elapsedMs, cause: err };
  }

  const message = err instanceof Error ? err.message : String(err);
  return { type: 'unknown', message, attempt, elapsedMs, cause: err };
}

function makeRetryError(
  payload: RetryErrorPayload,
  attempts: number,
  totalElapsedMs: number,
  budgetExhausted?: boolean,
): RetryError {
  return {
    ...payload,
    metadata: { attempts, totalElapsedMs, lastError: payload, budgetExhausted },
  };
}

// ─── Executor ────────────────────────────────────────────────────────────────

export class RetryExecutor {
  constructor(
    private deps: ExecutorDependencies,
    private config: RetryConfig,
  ) {}

  async run<T>(task: (signal: AbortSignal) => Promise<T>): Promise<Result<T, RetryError>> {
    try {
      return await this.attempt(task);
    } finally {
      this.deps.timeoutManager.dispose();
    }
  }

  private async attempt<T>(task: (signal: AbortSignal) => Promise<T>): Promise<Result<T, RetryError>> {
    const {
      backoff, budget, classifier, timeoutManager,
      RetryCondition, abortCondition, hooks,
      circuitBreaker, bulkhead, logger, metrics, correlationId,
      idempotency,
    } = this.deps;
    const { maxAttempts = 3, dynamicDelay, fallback } = this.config;
    const idempotencyKey = this.config.idempotency?.key;

    const startTime = Date.now();
    let lastError: RetryErrorPayload | undefined;

    // Return cached result for duplicate requests. Cached as { value } rather
    // than the bare value -- JSON.stringify(undefined) is `undefined`, not a
    // string, so a task resolving `undefined` would otherwise fail to
    // round-trip through the store.
    if (idempotency && idempotencyKey) {
      const cached = await idempotency.getResult(idempotencyKey);
      if (cached !== null) {
        return ok((JSON.parse(cached) as { value: T }).value);
      }
    }

    budget?.recordCall();

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      // Global timeout check at the start of each attempt
      try {
        timeoutManager.checkGlobalTimeout();
      } catch (err) {
        const payload = normalizeError(err, attempt, startTime);
        await hooks.onExhausted({ lastError: payload, totalAttempts: attempt - 1, totalElapsedMs: Date.now() - startTime });
        return fail(makeRetryError(payload, attempt - 1, Date.now() - startTime));
      }

      // Circuit breaker check
      if (circuitBreaker && !circuitBreaker.canAttempt()) {
        const payload: RetryErrorPayload = {
          type: 'circuit-open',
          message: 'Circuit breaker is open',
          attempt,
          elapsedMs: Date.now() - startTime,
        };
        if (attempt >= maxAttempts || await abortCondition.shouldAbort(payload)) {
          await hooks.onExhausted({ lastError: payload, totalAttempts: attempt, totalElapsedMs: Date.now() - startTime });
          return fail(makeRetryError(payload, attempt, Date.now() - startTime));
        }
        lastError = payload;
        const delay = dynamicDelay?.(payload, attempt) ?? backoff.nextDelay(attempt);
        await hooks.beforeRetry({ attempt, error: payload, delayMs: delay });
        await sleep(delay);
        await hooks.afterRetry({ attempt, error: payload, delayMs: delay });
        continue;
      }

      // Execute the task (with optional bulkhead + per-attempt timeout)
      const attemptStart = Date.now();
      try {
        const executeTask = (): Promise<T> => timeoutManager.executeWithAttemptTimeout(task);
        const value = await (bulkhead ? bulkhead.execute(executeTask) : executeTask());

        // SUCCESS -- duration is for this attempt alone, not the cumulative
        // time across earlier failed attempts and their backoff delays.
        circuitBreaker?.onSuccess(Date.now() - attemptStart);
        budget?.recordSuccess();

        if (attempt > 1) {
          await hooks.onRetrySuccess({ attempt, totalAttempts: attempt, totalElapsedMs: Date.now() - startTime });
        }
        metrics?.emit({ name: 'Retry.success', value: 1, tags: { attempt: String(attempt) } });
        if (idempotency && idempotencyKey) {
          await idempotency.storeResult(idempotencyKey, JSON.stringify({ value }));
        }
        return ok(value);

      } catch (err) {
        const payload = normalizeError(err, attempt, startTime);
        lastError = payload;

        const classification = classifier.classify(payload);

        // Only notify the circuit breaker of transient (infrastructure-shaped)
        // failures -- a permanent/business failure (e.g. 404, 422) says nothing
        // about whether the dependency itself is healthy.
        if (classification === 'transient') {
          circuitBreaker?.onError(err);
        }
        budget?.recordFailure();

        logger?.warn('Retry: attempt failed', { attempt, message: payload.message, type: payload.type, classification, correlationId });
        metrics?.emit({ name: 'Retry.attempt_failed', value: 1, tags: { attempt: String(attempt), type: payload.type, classification } });

        // Abort condition — stop immediately, no fallback
        if (await abortCondition.shouldAbort(payload)) {
          return fail(makeRetryError(payload, attempt, Date.now() - startTime));
        }

        // Retry condition — if false, treat as exhausted
        if (!(await RetryCondition.shouldRetry(payload))) {
          await hooks.onExhausted({ lastError: payload, totalAttempts: attempt, totalElapsedMs: Date.now() - startTime });
          if (fallback) return ok((await fallback(payload)) as T);
          return fail(makeRetryError(payload, attempt, Date.now() - startTime));
        }

        // Max attempts reached
        if (attempt >= maxAttempts) {
          await hooks.onExhausted({ lastError: payload, totalAttempts: attempt, totalElapsedMs: Date.now() - startTime });
          if (fallback) return ok((await fallback(payload)) as T);
          return fail(makeRetryError(payload, attempt, Date.now() - startTime));
        }

        // Budget check before scheduling the retry
        if (budget && !budget.tryConsume()) {
          await hooks.onBudgetExhausted();
          metrics?.emit({ name: 'Retry.budget_exhausted', value: 1 });
          if (fallback) return ok((await fallback(payload)) as T);
          return fail(makeRetryError(payload, attempt, Date.now() - startTime, true));
        }

        // Schedule retry with backoff
        const delay = dynamicDelay?.(payload, attempt) ?? backoff.nextDelay(attempt);
        await hooks.beforeRetry({ attempt, error: payload, delayMs: delay });
        await sleep(delay);
        await hooks.afterRetry({ attempt, error: payload, delayMs: delay });
      }
    }

    // Safety net — logically unreachable but satisfies TypeScript
    const payload = lastError ?? {
      type: 'unknown' as const,
      message: 'Retry loop exhausted without error',
      attempt: maxAttempts,
      elapsedMs: Date.now() - startTime,
    };
    await hooks.onExhausted({ lastError: payload, totalAttempts: maxAttempts, totalElapsedMs: Date.now() - startTime });
    if (fallback) return ok((await fallback(payload)) as T);
    return fail(makeRetryError(payload, maxAttempts, Date.now() - startTime));
  }
}
