// ---------------------------------------------------------------------------
// @backendkit-labs/saga — src/persistence/saga-store.interface.ts
//
// SagaStore: abstract persistence contract for SagaState.
// Locking is NOT here — it lives in LockProvider.
// ---------------------------------------------------------------------------

import type { SagaState, SagaFilter, SagaId } from '../types/saga.types';
import type { SagaResult } from '../types/error.types';

export interface SagaStore {
  save(state: SagaState): Promise<SagaResult<void>>;
  load(sagaId: SagaId): Promise<SagaResult<SagaState>>;
  list(filter?: SagaFilter): Promise<SagaResult<SagaState[]>>;
  delete(sagaId: SagaId): Promise<SagaResult<void>>;
  findByEventToken(token: string): Promise<SagaResult<SagaState>>;
}
