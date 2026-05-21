// ---------------------------------------------------------------------------
// @backendkit-labs/saga — src/types/error.types.ts
//
// Error type hierarchy: StepError (business/infrastructure/timeout),
// SagaEngineError (7 categories), SagaError union, SagaResult<T> alias.
// ---------------------------------------------------------------------------

import type { SagaId, SagaStatus } from './saga.types';

// ---- StepError (retry classification) ----

export type StepError =
  | { type: 'BUSINESS_ERROR'; step: string; cause: Error; code: string }
  | { type: 'INFRASTRUCTURE_ERROR'; step: string; cause: Error; code: string }
  | { type: 'STEP_TIMEOUT'; step: string; timeoutMs: number };

// ---- SagaEngineError (7 categories) ----

export type SagaEngineError =
  | { category: 'COMPENSATION_ERROR'; step: string; cause: Error }
  | { category: 'RETRY_EXHAUSTED'; step: string; attempts: number }
  | { category: 'PERSISTENCE_ERROR'; cause: Error }
  | { category: 'LOCK_ACQUISITION_FAILED'; lockKey: string }
  | { category: 'SAGA_NOT_FOUND'; sagaId: SagaId }
  | { category: 'DEFINITION_NOT_REGISTERED'; sagaType: string }
  | { category: 'INVALID_TRANSITION'; from: SagaStatus; to: SagaStatus }
  | { category: 'SAGA_INTERNAL'; cause: Error };

// ---- SagaError union ----

export type SagaError = StepError | SagaEngineError;

// ---- SagaResult<T> alias ----
// Re-export Result from @backendkit-labs/result so consumers get the type

export type { Result } from '@backendkit-labs/result';
export type SagaResult<T> = import('@backendkit-labs/result').Result<T, SagaError>;
