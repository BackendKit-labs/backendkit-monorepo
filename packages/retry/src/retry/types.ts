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
  | { type: 'fixed';       baseDelay: number }
  | { type: 'linear';      baseDelay: number; multiplier?: number; maxDelay?: number }
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
  | 'http'
  | 'network'
  | 'timeout'
  | 'circuit-open'
  | 'bulkhead-rejected'
  | 'business'
  | 'unknown';

export interface RetryMetadata {
  attempts: number;
  totalElapsedMs: number;
  lastError?: RetryErrorPayload;
  budgetExhausted?: boolean;
  circuitOpen?: boolean;
}

export type RetryError = RetryErrorPayload & { metadata: RetryMetadata };

// ---- Metrics ----

export interface RetryMetricsSnapshot {
  totalAttempts: number;
  totalSuccesses: number;
  totalFailures: number;
  totalExhausted: number;
  totalBudgetExhausted: number;
  totalTimeouts: number;
}

// ---- Main Config ----

export interface RetryConfig {
  maxAttempts: number;
  backoff: BackoffConfig | BackoffStrategy;
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
  /** External integrations (optional -- duck-typed at runtime). */
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

// ---- Forward reference (resolves circular dependency) ----
import type { RetryRegistry } from './retry.registry.js';
