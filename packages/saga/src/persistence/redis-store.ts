// ---------------------------------------------------------------------------
// @backendkit-labs/saga — src/persistence/redis-store.ts
//
// Redis SagaStore implementation.
// Duck-typed client: works with ioredis, upstash/redis, or any compatible client.
//
// Key schema:
//   saga:state:{sagaId}          → JSON string of SagaState (with optional TTL)
//   saga:index:all               → sorted set sagaId → createdAt (score)
//   saga:index:status:{status}   → set of sagaIds
//   saga:index:type:{sagaType}   → set of sagaIds
// ---------------------------------------------------------------------------

import { ok, fail } from '@backendkit-labs/result';
import type { SagaState, SagaFilter, SagaId } from '../types/saga.types';
import type { SagaResult } from '../types/error.types';
import type { SagaStore } from './saga-store.interface';

// ---- Duck-typed Redis client ----

export interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<'OK' | null>;
  expire(key: string, seconds: number): Promise<number>;
  del(key: string): Promise<number>;
  zadd(key: string, score: number, member: string): Promise<number>;
  zrangebyscore(key: string, min: number | '-inf', max: number | '+inf', options?: { limit?: { offset: number; count: number } }): Promise<string[]>;
  zrem(key: string, member: string): Promise<number>;
  sadd(key: string, member: string): Promise<number>;
  smembers(key: string): Promise<string[]>;
  srem(key: string, member: string): Promise<number>;
}

// ---- Options ----

export interface RedisAdapterOptions {
  keyPrefix?: string;
  ttlSeconds?: number;
}

/** @deprecated Use RedisAdapterOptions */
export type RedisSagaStoreOptions = RedisAdapterOptions;

// ---- Implementation ----

export class RedisAdapter implements SagaStore {
  private readonly prefix: string;
  private readonly ttl?: number;

  constructor(
    private readonly client: RedisClient,
    options: RedisAdapterOptions = {},
  ) {
    this.prefix = options.keyPrefix ?? 'saga';
    this.ttl = options.ttlSeconds;
  }

  async save(state: SagaState): Promise<SagaResult<void>> {
    try {
      const key = this.stateKey(state.id);
      const existing = await this.client.get(key);

      if (existing !== null) {
        const prev = JSON.parse(existing) as { version: number; status: string };
        if (prev.version !== state.version - 1) {
          return fail({
            category: 'PERSISTENCE_ERROR',
            cause: new Error(
              `Version conflict for saga ${state.id}: stored=${prev.version}, incoming=${state.version - 1}`,
            ),
          });
        }
        // Remove old status index entry before updating
        await this.client.srem(`${this.prefix}:index:status:${prev.status}`, state.id);
      }

      // Remove old token index if token changed or cleared
      if (existing !== null) {
        const prev = JSON.parse(existing) as { eventToken?: string };
        if (prev.eventToken !== undefined && prev.eventToken !== state.eventToken) {
          await this.client.del(this.tokenKey(prev.eventToken));
        }
      }

      // Save state
      await this.client.set(key, JSON.stringify(state));
      if (this.ttl !== undefined) {
        await this.client.expire(key, this.ttl);
      }

      // Update token index
      if (state.eventToken !== undefined) {
        await this.client.set(this.tokenKey(state.eventToken), state.id);
        if (this.ttl !== undefined) {
          await this.client.expire(this.tokenKey(state.eventToken), this.ttl);
        }
      }

      // Update indexes
      await this.client.zadd(`${this.prefix}:index:all`, state.createdAt, state.id);
      await this.client.sadd(`${this.prefix}:index:status:${state.status}`, state.id);
      await this.client.sadd(`${this.prefix}:index:type:${state.sagaType}`, state.id);

      return ok(undefined);
    } catch (err) {
      return fail({
        category: 'PERSISTENCE_ERROR',
        cause: err instanceof Error ? err : new Error(String(err)),
      });
    }
  }

  async load(sagaId: SagaId): Promise<SagaResult<SagaState>> {
    try {
      const raw = await this.client.get(this.stateKey(sagaId));

      if (raw === null) {
        return fail({ category: 'SAGA_NOT_FOUND', sagaId });
      }

      return ok(JSON.parse(raw) as SagaState);
    } catch (err) {
      return fail({
        category: 'PERSISTENCE_ERROR',
        cause: err instanceof Error ? err : new Error(String(err)),
      });
    }
  }

  async list(filter?: SagaFilter): Promise<SagaResult<SagaState[]>> {
    try {
      let sagaIds: string[];

      if (filter?.status !== undefined && filter?.sagaType !== undefined) {
        // Intersection: load from type index then filter by status
        const byType = await this.client.smembers(`${this.prefix}:index:type:${filter.sagaType}`);
        const byStatus = new Set(
          await this.client.smembers(`${this.prefix}:index:status:${filter.status}`),
        );
        sagaIds = byType.filter((id) => byStatus.has(id));
      } else if (filter?.status !== undefined) {
        sagaIds = await this.client.smembers(`${this.prefix}:index:status:${filter.status}`);
      } else if (filter?.sagaType !== undefined) {
        sagaIds = await this.client.smembers(`${this.prefix}:index:type:${filter.sagaType}`);
      } else {
        // All sagas ordered by createdAt descending via sorted set
        const minScore = filter?.createdAfter ?? '-inf';
        const maxScore = filter?.createdBefore ?? '+inf';
        sagaIds = await this.client.zrangebyscore(
          `${this.prefix}:index:all`,
          minScore,
          maxScore,
        );
        sagaIds = sagaIds.reverse(); // newest first
      }

      // Load states
      const states: SagaState[] = [];
      for (const id of sagaIds) {
        const raw = await this.client.get(this.stateKey(id as SagaId));
        if (raw !== null) {
          const state = JSON.parse(raw) as SagaState;

          // Apply time filters if using set-based lookup (no score ordering)
          if (filter?.createdAfter !== undefined && state.createdAt < filter.createdAfter) continue;
          if (filter?.createdBefore !== undefined && state.createdAt > filter.createdBefore) continue;

          states.push(state);
        }
      }

      // Sort descending by createdAt
      states.sort((a, b) => b.createdAt - a.createdAt);

      // Pagination
      const offset = filter?.offset ?? 0;
      const limit = filter?.limit ?? states.length;
      return ok(states.slice(offset, offset + limit));
    } catch (err) {
      return fail({
        category: 'PERSISTENCE_ERROR',
        cause: err instanceof Error ? err : new Error(String(err)),
      });
    }
  }

  async delete(sagaId: SagaId): Promise<SagaResult<void>> {
    try {
      const raw = await this.client.get(this.stateKey(sagaId));
      if (raw === null) {
        return fail({ category: 'SAGA_NOT_FOUND', sagaId });
      }

      const state = JSON.parse(raw) as SagaState;

      if (state.eventToken !== undefined) {
        await this.client.del(this.tokenKey(state.eventToken));
      }
      await this.client.del(this.stateKey(sagaId));
      await this.client.zrem(`${this.prefix}:index:all`, sagaId);
      await this.client.srem(`${this.prefix}:index:status:${state.status}`, sagaId);
      await this.client.srem(`${this.prefix}:index:type:${state.sagaType}`, sagaId);

      return ok(undefined);
    } catch (err) {
      return fail({
        category: 'PERSISTENCE_ERROR',
        cause: err instanceof Error ? err : new Error(String(err)),
      });
    }
  }

  async findByEventToken(token: string): Promise<SagaResult<SagaState>> {
    try {
      const sagaId = await this.client.get(this.tokenKey(token));
      if (sagaId === null) {
        return fail({ category: 'SAGA_NOT_FOUND', sagaId: token as SagaId });
      }
      return this.load(sagaId as SagaId);
    } catch (err) {
      return fail({
        category: 'PERSISTENCE_ERROR',
        cause: err instanceof Error ? err : new Error(String(err)),
      });
    }
  }

  private stateKey(sagaId: SagaId | string): string {
    return `${this.prefix}:state:${sagaId}`;
  }

  private tokenKey(token: string): string {
    return `${this.prefix}:token:${token}`;
  }
}
