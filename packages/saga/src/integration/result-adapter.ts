// ---------------------------------------------------------------------------
// @backendkit-labs/saga -- src/integration/result-adapter.ts
//
// Adapter for @backendkit-labs/result.
// Provides saga-specific Result combinators for step chaining and
// error classification.
//
// Always required (Result is a direct dependency).
// ---------------------------------------------------------------------------

import { ok, isOk, isFail } from '@backendkit-labs/result';
import type { SagaResult, StepError, SagaError, SagaEngineError } from '../types/error.types';

// ---- Step error constructors ----

export function businessError(step: string, cause: Error, code: string): StepError {
  return { type: 'BUSINESS_ERROR', step, cause, code };
}

export function infrastructureError(step: string, cause: Error, code: string): StepError {
  return { type: 'INFRASTRUCTURE_ERROR', step, cause, code };
}

export function stepTimeout(step: string, timeoutMs: number): StepError {
  return { type: 'STEP_TIMEOUT', step, timeoutMs };
}

// ---- Saga engine error constructors ----

export function compensationError(step: string, cause: Error): SagaEngineError {
  return { category: 'COMPENSATION_ERROR', step, cause };
}

export function retryExhausted(step: string, attempts: number): SagaEngineError {
  return { category: 'RETRY_EXHAUSTED', step, attempts };
}

export function persistenceError(cause: Error): SagaEngineError {
  return { category: 'PERSISTENCE_ERROR', cause };
}

export function lockAcquisitionFailed(lockKey: string): SagaEngineError {
  return { category: 'LOCK_ACQUISITION_FAILED', lockKey };
}

export function sagaNotFoundError(sagaId: string): SagaEngineError {
  return { category: 'SAGA_NOT_FOUND', sagaId: sagaId as import('../types/saga.types').SagaId };
}

export function invalidTransition(from: string, to: string): SagaEngineError {
  return { category: 'INVALID_TRANSITION', from: from as import('../types/saga.types').SagaStatus, to: to as import('../types/saga.types').SagaStatus };
}

export function sagaInternal(cause: Error): SagaEngineError {
  return { category: 'SAGA_INTERNAL', cause };
}

// ---- Error classification helpers ----

export function isBusinessError(error: SagaError): boolean {
  return 'type' in error && error.type === 'BUSINESS_ERROR';
}

export function isInfrastructureError(error: SagaError): boolean {
  return 'type' in error && error.type === 'INFRASTRUCTURE_ERROR';
}

export function isStepTimeout(error: SagaError): boolean {
  return 'type' in error && error.type === 'STEP_TIMEOUT';
}

export function isCompensationError(error: SagaError): boolean {
  return 'category' in error && error.category === 'COMPENSATION_ERROR';
}

export function isRetryExhausted(error: SagaError): boolean {
  return 'category' in error && error.category === 'RETRY_EXHAUSTED';
}

export function isPersistenceError(error: SagaError): boolean {
  return 'category' in error && error.category === 'PERSISTENCE_ERROR';
}

export function isLockError(error: SagaError): boolean {
  return 'category' in error && error.category === 'LOCK_ACQUISITION_FAILED';
}

export function isTransientError(error: SagaError): boolean {
  if ('type' in error) {
    return error.type === 'INFRASTRUCTURE_ERROR' || error.type === 'STEP_TIMEOUT';
  }
  return (
    error.category === 'PERSISTENCE_ERROR' ||
    error.category === 'LOCK_ACQUISITION_FAILED'
  );
}

// ---- Step result combinators ----

/**
 * Chain two step handlers: if the first succeeds, pass its output to the
 * second. If it fails, propagate the error.
 */
export async function chainSteps<T1, T2>(
  step1: () => Promise<SagaResult<T1>>,
  step2: (input: T1) => Promise<SagaResult<T2>>,
): Promise<SagaResult<T2>> {
  const r1 = await step1();
  if (isFail(r1)) {
    return r1 as unknown as SagaResult<T2>;
  }
  return step2(r1.value);
}

/**
 * Map a saga result value using a transform function.
 */
export function mapResult<T, U>(
  result: SagaResult<T>,
  fn: (value: T) => U,
): SagaResult<U> {
  if (isOk(result)) {
    return ok(fn(result.value));
  }
  return result as unknown as SagaResult<U>;
}

/**
 * Tap into a saga result for side effects (e.g., logging).
 * Returns the original result unchanged.
 */
export function tapResult<T>(
  result: SagaResult<T>,
  fn: (value: T) => void,
): SagaResult<T> {
  if (isOk(result)) {
    fn(result.value);
  }
  return result;
}

/**
 * Recover from a failed saga result by providing a fallback value.
 */
export async function recoverResult<T>(
  result: SagaResult<T>,
  fallback: (error: SagaError) => T | Promise<T>,
): Promise<T> {
  if (isOk(result)) {
    return result.value;
  }
  return fallback(result.error);
}
