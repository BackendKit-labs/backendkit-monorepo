// ---------------------------------------------------------------------------
// @backendkit-labs/saga — src/lock/in-memory-lock.ts
//
// In-memory LockProvider implementation.
// Each lock entry stores acquisition timestamp and TTL.
// Uses currentTimestamp() from utils/time.
// ---------------------------------------------------------------------------

import { ok } from '@backendkit-labs/result';
import type { LockProvider } from '../types/lock.types';
import type { SagaResult } from '../types/error.types';
import { currentTimestamp } from '../utils/time';

interface LockEntry {
  acquired: number;  // timestamp ms
  ttlMs: number;
}

export class InMemoryLock implements LockProvider {
  private readonly locks = new Map<string, LockEntry>();

  async acquire(lockKey: string, ttlMs: number): Promise<SagaResult<boolean>> {
    const now = currentTimestamp();
    const existing = this.locks.get(lockKey);

    if (existing !== undefined && now < existing.acquired + existing.ttlMs) {
      return ok(false);
    }

    this.locks.set(lockKey, { acquired: now, ttlMs });
    return ok(true);
  }

  async release(lockKey: string): Promise<SagaResult<void>> {
    this.locks.delete(lockKey);
    return ok(undefined);
  }

  async isLocked(lockKey: string): Promise<SagaResult<boolean>> {
    const existing = this.locks.get(lockKey);

    if (existing === undefined) {
      return ok(false);
    }

    const now = currentTimestamp();
    const expired = now >= existing.acquired + existing.ttlMs;

    if (expired) {
      this.locks.delete(lockKey);
      return ok(false);
    }

    return ok(true);
  }
}
