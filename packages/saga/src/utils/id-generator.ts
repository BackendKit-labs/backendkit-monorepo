// ---------------------------------------------------------------------------
// @backendkit-labs/saga — src/utils/id-generator.ts
//
// ID generators: SagaId (UUID v7 branded), correlation ID, event ID.
// ---------------------------------------------------------------------------

import crypto from 'node:crypto';
import type { SagaId } from '../types/saga.types';

export function generateSagaId(): SagaId {
  return crypto.randomUUID() as SagaId;
}

export function generateCorrelationId(): string {
  return crypto.randomUUID();
}

export function generateEventId(): string {
  return crypto.randomUUID();
}
