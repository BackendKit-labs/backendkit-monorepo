import { type Result } from '@backendkit-labs/result';
import type { RetryConfig, RetryEngineConfig, RetryError, RetryMetricsSnapshot, RetryCondition, AbortCondition, RetryConditionFn, AbortConditionFn, BackoffConfig, BackoffStrategy } from './types.js';
import { RetryExecutor } from './retry.executor.js';
import { HookRunner } from './retry.hooks.js';
import { SlidingWindowBudgetImpl } from './retry.budget.js';
import { DefaultErrorClassifier } from '../conditions/error.classifier.js';
import { TimeoutManager } from '../timeout/timeout.manager.js';
import { IdempotencyManager } from '../idempotency/idempotency.manager.js';
import { FixedBackoff } from '../backoff/fixed.backoff.js';
import { LinearBackoff } from '../backoff/linear.backoff.js';
import { ExponentialBackoff } from '../backoff/exponential.backoff.js';
import { defaultRetryCondition, defaultAbortCondition } from '../conditions/http.conditions.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isBackoffStrategy(b: BackoffConfig | BackoffStrategy): b is BackoffStrategy {
  return typeof (b as BackoffStrategy).nextDelay === 'function';
}

function createBackoff(config: BackoffConfig): BackoffStrategy {
  switch (config.type) {
    case 'fixed':
      return new FixedBackoff({ baseDelay: config.baseDelay });
    case 'linear':
      return new LinearBackoff({ baseDelay: config.baseDelay, multiplier: config.multiplier, maxDelay: config.maxDelay });
    case 'exponential':
      return new ExponentialBackoff({ baseDelay: config.baseDelay, multiplier: config.multiplier, maxDelay: config.maxDelay, jitter: config.jitter });
  }
}

function wrapRetryCondition(condition?: RetryCondition | RetryConditionFn): RetryCondition {
  if (!condition) return defaultRetryCondition;
  if (typeof condition === 'function') return { shouldRetry: condition };
  return condition;
}

function wrapAbortCondition(condition?: AbortCondition | AbortConditionFn): AbortCondition {
  if (!condition) return defaultAbortCondition;
  if (typeof condition === 'function') return { shouldAbort: condition };
  return condition;
}

// ─── Engine ──────────────────────────────────────────────────────────────────

export class RetryEngine {
  private metrics: RetryMetricsSnapshot = {
    totalAttempts: 0,
    totalSuccesses: 0,
    totalFailures: 0,
    totalExhausted: 0,
    totalBudgetExhausted: 0,
    totalTimeouts: 0,
  };

  constructor(private config: RetryEngineConfig) {}

  async execute<T>(
    task: () => Promise<T>,
    options?: Partial<RetryConfig>,
  ): Promise<Result<T, RetryError>> {
    const merged: Partial<RetryConfig> = { ...this.config.defaultConfig, ...options };

    const backoffConfig: BackoffConfig = (!merged.backoff || isBackoffStrategy(merged.backoff))
      ? { type: 'fixed', baseDelay: 200 }
      : merged.backoff;

    const backoffStrategy = (merged.backoff && isBackoffStrategy(merged.backoff))
      ? merged.backoff.clone()
      : createBackoff(backoffConfig);

    const classifier = new DefaultErrorClassifier(merged.classifiers);

    const timeoutManager = new TimeoutManager({
      globalTimeoutMs: 0,
      attemptTimeoutMs: 0,
      ...merged.timeout,
    });

    const budget = merged.budget
      ? new SlidingWindowBudgetImpl({ windowMs: 60_000, maxRetryRatio: 0.1, minRequestCount: 10, ...merged.budget })
      : undefined;

    const idempotency =
      merged.idempotency?.enabled
        ? new IdempotencyManager({
            enabled: true,
            idempotentMethods: ['POST', 'PUT', 'PATCH'],
            headerName: 'Idempotency-Key',
            ttlMs: 24 * 60 * 60 * 1000,
            ...merged.idempotency,
          })
        : undefined;

    const hookRunner = new HookRunner(merged.hooks ?? {}, merged.correlationId);
    const RetryCondition = wrapRetryCondition(merged.retryIf);
    const abortCondition = wrapAbortCondition(merged.abortIf);

    const fullConfig: RetryConfig = {
      maxAttempts: 3,
      backoff: backoffConfig,
      ...merged,
    };

    const executor = new RetryExecutor(
      {
        backoff: backoffStrategy,
        budget,
        classifier,
        timeoutManager,
        idempotency,
        RetryCondition,
        abortCondition,
        hooks: hookRunner,
        circuitBreaker: this.config.integrations?.circuitBreaker,
        bulkhead: this.config.integrations?.bulkhead,
        logger: this.config.integrations?.observability?.logger,
        metrics: this.config.integrations?.observability?.metrics,
        correlationId: merged.correlationId,
      },
      fullConfig,
    );

    this.metrics.totalAttempts++;
    const result = await executor.run(task);

    if (result.ok) {
      this.metrics.totalSuccesses++;
    } else {
      this.metrics.totalFailures++;
      if (result.error.metadata.budgetExhausted) this.metrics.totalBudgetExhausted++;
      if (result.error.type === 'timeout') this.metrics.totalTimeouts++;
      if (result.error.metadata.attempts >= fullConfig.maxAttempts) this.metrics.totalExhausted++;
    }

    return result;
  }

  async executeWithContext<T>(
    task: () => Promise<T>,
    context: { correlationId?: string },
    options?: Partial<RetryConfig>,
  ): Promise<Result<T, RetryError>> {
    return this.execute(task, { ...options, correlationId: context.correlationId });
  }

  updateDefaults(partial: Partial<RetryConfig>): void {
    this.config.defaultConfig = { ...this.config.defaultConfig, ...partial };
  }

  getMetrics(): RetryMetricsSnapshot {
    return { ...this.metrics };
  }

  resetMetrics(): void {
    this.metrics = {
      totalAttempts: 0,
      totalSuccesses: 0,
      totalFailures: 0,
      totalExhausted: 0,
      totalBudgetExhausted: 0,
      totalTimeouts: 0,
    };
  }
}
