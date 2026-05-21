// ---------------------------------------------------------------------------
// @backendkit-labs/saga — src/types/events.types.ts
//
// Event types: SagaEventType (20 literals), SagaEvent, EventHandler,
// SagaEventBus interface for publish/subscribe.
// ---------------------------------------------------------------------------

import type { SagaId } from './saga.types';
import type { SagaError } from './error.types';

// ---- SagaEventType (20 literals) ----

export type SagaEventType =
  | 'SAGA_STARTED'
  | 'SAGA_COMPLETED'
  | 'SAGA_FAILED'
  | 'SAGA_PAUSED'
  | 'SAGA_RESUMED'
  | 'SAGA_RECOVERED'
  | 'SAGA_PARTIALLY_COMPENSATED'
  | 'SAGA_WAITING_FOR_EVENT'
  | 'SAGA_SIGNALED'
  | 'SAGA_WAIT_TIMEOUT'
  | 'STEP_STARTED'
  | 'STEP_SUCCEEDED'
  | 'STEP_FAILED'
  | 'STEP_RETRIED'
  | 'COMPENSATION_STARTED'
  | 'COMPENSATION_SUCCEEDED'
  | 'COMPENSATION_FAILED'
  | 'SAGA_TIMEOUT'
  | 'LOCK_ACQUIRED'
  | 'LOCK_RELEASED'
  | 'MANUAL_APPROVAL_REQUIRED'
  | 'MANUAL_APPROVAL_GRANTED'
  | 'MANUAL_APPROVAL_DENIED';

// ---- SagaEvent ----

export interface SagaEvent {
  id: string;                 // unique event id (UUID)
  sagaId: SagaId;
  eventType: SagaEventType;
  stepName?: string;
  payload?: unknown;
  error?: SagaError;
  timestamp: number;          // epoch ms
}

// ---- EventHandler ----

export type EventHandler = (event: SagaEvent) => void | Promise<void>;

// ---- SagaEventBus interface ----

export interface SagaEventBus {
  publish(event: SagaEvent): void | Promise<void>;
  subscribe(eventType: SagaEventType, handler: EventHandler): () => void;  // returns unsubscribe fn
  unsubscribe(eventType: SagaEventType, handler: EventHandler): void;
  subscribeAll(handler: EventHandler): () => void;  // returns unsubscribe fn
}
