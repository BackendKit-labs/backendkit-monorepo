// ---------------------------------------------------------------------------
// @backendkit-labs/saga -- src/integration/circuit-breaker-adapter.ts
//
// Real adapter for @backendkit-labs/circuit-breaker. Wraps a saga step
// function in the actual CircuitBreaker state machine (sliding window,
// half-open probing, onStateChange hooks) instead of a hand-rolled one,
// classifying SagaResult failures as business vs infrastructure the same
// way this package's own StepError/SagaEngineError types already do.
//
// Optional peer dependency -- @backendkit-labs/circuit-breaker is imported
// dynamically, lazily, on first use. Constructing a SagaCircuitBreaker
// without it installed is fine; calling execute()/getState()/reset() on one
// throws a clear error telling you to install it.
// ---------------------------------------------------------------------------

import { ok, fail } from '@backendkit-labs/result';
import { isOk } from '@backendkit-labs/result';
import { isInfrastructureError, isPersistenceError, isLockError } from './result-adapter.js';
import type { SagaResult, SagaError, StepError, SagaEngineError } from '../types/error.types';
import type {
  CircuitBreaker as RealCircuitBreaker,
  CircuitBreakerConfig as RealCircuitBreakerConfig,
  CircuitBreakerMetrics,
  CircuitBreakerState,
} from '@backendkit-labs/circuit-breaker';

/**
 * Saga-flavored subset of @backendkit-labs/circuit-breaker's own
 * CircuitBreakerConfig -- same percentage + sliding-window semantics, same
 * field names. `name` defaults to `'saga'`. `isFailure` isn't accepted here:
 * SagaCircuitBreaker always classifies via {@link isCircuitBreakerFailure}, so
 * BUSINESS_ERROR/STEP_TIMEOUT steps never trip it and INFRASTRUCTURE_ERROR/
 * PERSISTENCE_ERROR/LOCK_ACQUISITION_FAILED always do -- override that
 * yourself by using @backendkit-labs/circuit-breaker directly if you need a
 * different split.
 */
export type CircuitBreakerConfig = Partial<Omit<RealCircuitBreakerConfig, 'isFailure'>>;

export type { CircuitBreakerMetrics, CircuitBreakerState };

/**
 * Classifies a SagaError as an infrastructure failure (opens the circuit) or
 * a business error (transparent) -- built from this package's own
 * isInfrastructureError/isPersistenceError/isLockError classifiers
 * (./result-adapter.js) rather than re-deriving the split.
 */
export function isCircuitBreakerFailure(error: SagaError): boolean {
  return isInfrastructureError(error) || isPersistenceError(error) || isLockError(error);
}

/**
 * SagaCircuitBreaker wraps @backendkit-labs/circuit-breaker so saga steps
 * can be protected without each caller re-deriving the business/infra split
 * from StepError/SagaEngineError themselves.
 *
 * Usage:
 *   const cb = new SagaCircuitBreaker({ failureThreshold: 50, openTimeoutMs: 30_000 });
 *   const result = await cb.execute(() => step.execute(ctx));
 */
export class SagaCircuitBreaker {
  private readonly module: Promise<typeof import('@backendkit-labs/circuit-breaker')>;
  private readonly ready: Promise<RealCircuitBreaker>;

  constructor(private readonly config: CircuitBreakerConfig = {}) {
    this.module = SagaCircuitBreaker.load();
    this.ready = this.module.then(({ CircuitBreaker }) => new CircuitBreaker({
      name: 'saga',
      ...this.config,
      isFailure: (error: unknown) => isCircuitBreakerFailure(error as SagaError),
    }));
  }

  async execute<T>(fn: () => Promise<SagaResult<T>>): Promise<SagaResult<T>> {
    const [cb, { CircuitBreakerOpenError }] = await Promise.all([this.ready, this.module]);

    try {
      const value = await cb.execute(async () => {
        const result = await fn();
        if (isOk(result)) return result.value;
        throw result.error;
      });
      return ok(value);
    } catch (error) {
      if (error instanceof CircuitBreakerOpenError) {
        return fail({ category: 'SAGA_INTERNAL', cause: error } as const);
      }
      // Anything else was thrown by us above -- it's the original SagaError.
      return fail(error as StepError | SagaEngineError);
    }
  }

  async getState(): Promise<CircuitBreakerState> {
    const cb = await this.ready;
    return cb.getState();
  }

  async getMetrics(): Promise<CircuitBreakerMetrics> {
    const cb = await this.ready;
    return cb.getMetrics();
  }

  async reset(): Promise<void> {
    const cb = await this.ready;
    cb.reset();
  }

  private static async load(): Promise<typeof import('@backendkit-labs/circuit-breaker')> {
    try {
      return await import('@backendkit-labs/circuit-breaker');
    } catch {
      throw new Error(
        '@backendkit-labs/circuit-breaker is required to use SagaCircuitBreaker. ' +
        'Install it: npm install @backendkit-labs/circuit-breaker',
      );
    }
  }
}
