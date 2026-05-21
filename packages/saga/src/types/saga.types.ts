// ---------------------------------------------------------------------------
// @backendkit-labs/saga — src/types/saga.types.ts
//
// Core type definitions: SagaId (branded), SagaStatus/StepStatus enums,
// StepState, SagaState, SagaFilter, SagaOutput (return value).
// ---------------------------------------------------------------------------

import type { SagaError } from './error.types';
import type { SagaEvent } from './events.types';

// ---- SagaId (branded type) ----

export type SagaId = string & { readonly __brand: 'SagaId' };

// ---- SagaStatus (9 states) ----

export enum SagaStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  STEP_EXECUTING = 'STEP_EXECUTING',
  WAITING_FOR_EVENT = 'WAITING_FOR_EVENT',
  COMPENSATING = 'COMPENSATING',
  COMPENSATION_DONE = 'COMPENSATION_DONE',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  PARTIALLY_COMPENSATED = 'PARTIALLY_COMPENSATED',
  PAUSED = 'PAUSED',
}

// ---- StepStatus (6 states) ----

export enum StepStatus {
  PENDING = 'PENDING',
  EXECUTING = 'EXECUTING',
  WAITING_FOR_SIGNAL = 'WAITING_FOR_SIGNAL',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  COMPENSATED = 'COMPENSATED',
  COMPENSATION_FAILED = 'COMPENSATION_FAILED',
}

// ---- StepState ----

export interface StepState {
  name: string;
  status: StepStatus;
  input?: unknown;
  output?: unknown;
  attempt: number;
  startedAt?: number;
  completedAt?: number;
  error?: SagaError;
}

// ---- SagaState ----

export interface SagaState {
  id: SagaId;
  sagaType: string;
  status: SagaStatus;
  correlationId: string;
  steps: StepState[];
  currentStepIndex: number;
  createdAt: number;         // timestamp ms
  updatedAt: number;         // timestamp ms
  completedAt?: number;      // timestamp ms
  metadata: Record<string, unknown>;
  version: number;           // optimistic locking
  lockExpiresAt?: number;    // timestamp ms
  eventToken?: string;       // signal token when status === WAITING_FOR_EVENT
  waitExpiresAt?: number;    // timestamp ms — if set, wait fails after this time
}

// ---- SagaFilter ----

export interface SagaFilter {
  status?: SagaStatus;
  sagaType?: string;
  createdAfter?: number;     // timestamp ms
  createdBefore?: number;    // timestamp ms
  limit?: number;
  offset?: number;
}

// ---- SagaOutput (value returned by SagaInstance.start()/resume()) ----

export interface SagaOutput {
  sagaId: SagaId;
  status: SagaStatus;
  completedAt?: number;      // timestamp ms
  timeline: SagaEvent[];
  output?: unknown;
}
