// ---------------------------------------------------------------------------
// @backendkit-labs/saga — src/types/lock.types.ts
//
// LockProvider interface for distributed locking.
// All operations return SagaResult.
// ---------------------------------------------------------------------------

import type { SagaResult } from './error.types';

// ---- LockProvider ----

export interface LockProvider {
  acquire(lockKey: string, ttlMs: number): Promise<SagaResult<boolean>>;
  release(lockKey: string): Promise<SagaResult<void>>;
  isLocked(lockKey: string): Promise<SagaResult<boolean>>;
}
