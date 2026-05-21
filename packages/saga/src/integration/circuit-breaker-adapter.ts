// ---------------------------------------------------------------------------
// @backendkit-labs/saga -- src/integration/circuit-breaker-adapter.ts
//
// Adapter for @backendkit-labs/circuit-breaker.
// Provides a saga-friendly wrapper that classifies failures as business
// vs infrastructure for circuit breaker decisions.
//
// Optional peer dependency -- import only if @backendkit-labs/circuit-breaker
// is installed.
// ---------------------------------------------------------------------------

import { fail, isOk } from '@backendkit-labs/result';
import type { SagaResult } from '../types/error.types';

export interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeoutMs: number;
  halfOpenMaxRequests?: number;
}

export interface CircuitBreakerState {
  opened: boolean;
  failureCount: number;
  successCount: number;
  lastFailureAt?: number;
}

/**
 * SagaCircuitBreaker wraps an external circuit-breaker implementation.
 * Usage:
 *   const cb = new SagaCircuitBreaker(config);
 *   const result = await cb.execute(() => step.execute(ctx));
 */
export class SagaCircuitBreaker {
  private state: CircuitBreakerState = {
    opened: false,
    failureCount: 0,
    successCount: 0,
  };

  constructor(private readonly config: CircuitBreakerConfig) {}

  async execute<T>(fn: () => Promise<SagaResult<T>>): Promise<SagaResult<T>> {
    if (this.state.opened) {
      const elapsed = Date.now() - (this.state.lastFailureAt ?? 0);
      if (elapsed >= this.config.timeoutMs) {
        // Move to half-open -- allow one request
        this.state.opened = false;
        this.state.failureCount = 0;
      } else {
        return fail({
          category: 'SAGA_INTERNAL',
          cause: new Error('Circuit breaker is OPEN'),
        } as const);
      }
    }

    const result = await fn();

    // Classify result to update circuit breaker state
    if (isOk(result)) {
      this.onSuccess();
    } else {
      const error = result.error;
      const shouldTrip =
        ('type' in error && error.type === 'INFRASTRUCTURE_ERROR') ||
        ('category' in error && (error.category === 'PERSISTENCE_ERROR' || error.category === 'LOCK_ACQUISITION_FAILED'));

      if (shouldTrip) {
        this.onFailure();
      }
    }

    return result;
  }

  getState(): CircuitBreakerState {
    return { ...this.state };
  }

  reset(): void {
    this.state = { opened: false, failureCount: 0, successCount: 0 };
  }

  private onSuccess(): void {
    this.state.successCount++;
    if (this.state.successCount >= this.config.successThreshold) {
      this.state.successCount = 0;
      this.state.opened = false;
      this.state.failureCount = 0;
    }
  }

  private onFailure(): void {
    this.state.failureCount++;
    this.state.lastFailureAt = Date.now();
    if (this.state.failureCount >= this.config.failureThreshold) {
      this.state.opened = true;
      this.state.successCount = 0;
    }
  }
}
