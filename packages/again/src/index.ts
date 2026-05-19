// Core
export { AgainEngine } from './again/again.engine.js';
export { AgainRegistry } from './again/again.registry.js';
export { again } from './again/again.fn.js';

// Config types
export type {
  AgainConfig,
  AgainEngineConfig,
  BackoffConfig,
  BackoffStrategy,
  JitterType,
  AgainCondition,
  AbortCondition,
  AgainConditionFn,
  AbortConditionFn,
  AgainBudgetConfig,
  TimeoutConfig,
  IdempotencyConfig,
  IdempotencyStore,
  ClassifierRule,
  ErrorClassification,
  AgainHooks,
  BeforeRetryContext,
  AfterRetryContext,
  RetrySuccessContext,
  ExhaustedContext,
  BudgetExhaustedContext,
  AgainErrorPayload,
  AgainError,
  ErrorType,
  AgainMetadata,
  AgainMetricsSnapshot,
  CircuitBreakerLike,
  BulkheadLike,
  BkLoggerLike,
  MetricsEmitterLike,
  MetricEvent,
} from './again/types.js';

// Backoff strategies
export { FixedBackoff } from './backoff/fixed.backoff.js';
export { LinearBackoff } from './backoff/linear.backoff.js';
export { ExponentialBackoff } from './backoff/exponential.backoff.js';
export { JitterDecorator, applyJitter } from './backoff/jitter.decorator.js';

// Conditions
export { defaultAgainCondition, defaultAbortCondition } from './conditions/http.conditions.js';
export { DefaultErrorClassifier } from './conditions/error.classifier.js';

// Budget
export { SlidingWindowBudgetImpl } from './again/again.budget.js';
export type { SlidingWindowBudget, BudgetMetrics } from './again/again.budget.js';

// Timeout
export { TimeoutManager } from './timeout/timeout.manager.js';
export { AttemptTimeoutError, GlobalTimeoutError } from './timeout/timeout.errors.js';

// Idempotency
export { IdempotencyManager } from './idempotency/idempotency.manager.js';
export { InMemoryIdempotencyStore } from './idempotency/memory.store.js';

// Errors
export { AgainExhaustedError, BudgetExhaustedError } from './again/again.errors.js';
