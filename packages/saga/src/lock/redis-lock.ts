// ---------------------------------------------------------------------------
// @backendkit-labs/saga — src/lock/redis-lock.ts
//
// Redis distributed LockProvider.
// Uses SET NX PX for acquire (atomic) and DEL for release.
// Duck-typed client: works with ioredis, upstash/redis, or any compatible client.
//
// Key schema: saga:lock:{lockKey}
// ---------------------------------------------------------------------------

import { ok, fail } from '@backendkit-labs/result';
import type { LockProvider } from '../types/lock.types';
import type { SagaResult } from '../types/error.types';

// ---- Duck-typed Redis client ----

export interface RedisLockClient {
  set(key: string, value: string, mode: 'NX', duration: 'PX', ttl: number): Promise<'OK' | null>;
  get(key: string): Promise<string | null>;
  del(key: string): Promise<number>;
}

// ---- Implementation ----

export class RedisLockAdapter implements LockProvider {
  private readonly prefix: string;

  constructor(
    private readonly client: RedisLockClient,
    options: { keyPrefix?: string } = {},
  ) {
    this.prefix = options.keyPrefix ?? 'saga:lock';
  }

  async acquire(lockKey: string, ttlMs: number): Promise<SagaResult<boolean>> {
    try {
      const key = this.key(lockKey);
      const result = await this.client.set(key, '1', 'NX', 'PX', ttlMs);
      return ok(result === 'OK');
    } catch (err) {
      return fail({
        category: 'LOCK_ACQUISITION_FAILED',
        lockKey,
      });
    }
  }

  async release(lockKey: string): Promise<SagaResult<void>> {
    try {
      await this.client.del(this.key(lockKey));
      return ok(undefined);
    } catch (err) {
      return fail({
        category: 'PERSISTENCE_ERROR',
        cause: err instanceof Error ? err : new Error(String(err)),
      });
    }
  }

  async isLocked(lockKey: string): Promise<SagaResult<boolean>> {
    try {
      const value = await this.client.get(this.key(lockKey));
      return ok(value !== null);
    } catch (err) {
      return fail({
        category: 'PERSISTENCE_ERROR',
        cause: err instanceof Error ? err : new Error(String(err)),
      });
    }
  }

  private key(lockKey: string): string {
    return `${this.prefix}:${lockKey}`;
  }
}
