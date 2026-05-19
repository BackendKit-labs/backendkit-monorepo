import { Injectable } from '@nestjs/common';
import type { IdempotencyRecord } from '../idempotency.types.js';
import type { IdempotencyStore } from './idempotency-store.interface.js';

/** Minimal interface so callers don't need a specific Redis client package. */
export interface RedisClient {
  set(key: string, value: string, options: { nx: boolean; ex: number }): Promise<string | null>;
  get(key: string): Promise<string | null>;
  setex(key: string, seconds: number, value: string): Promise<unknown>;
  del(key: string): Promise<unknown>;
}

@Injectable()
export class RedisIdempotencyStore implements IdempotencyStore {
  constructor(private readonly redis: RedisClient) {}

  async setIfAbsent(record: IdempotencyRecord, ttlSeconds: number): Promise<IdempotencyRecord | null> {
    const value = JSON.stringify(record);
    // SET key value NX EX ttl — atomic, no GET+SET race
    const result = await this.redis.set(record.key, value, { nx: true, ex: ttlSeconds });
    if (result !== null) {
      // SET succeeded (key was absent) → first time we see this key
      return null;
    }
    // key already existed — return whatever is stored
    const existing = await this.redis.get(record.key);
    return existing ? (JSON.parse(existing) as IdempotencyRecord) : null;
  }

  async get(key: string): Promise<IdempotencyRecord | null> {
    const raw = await this.redis.get(key);
    return raw ? (JSON.parse(raw) as IdempotencyRecord) : null;
  }

  async complete(key: string, statusCode: number, body: unknown, ttlSeconds: number): Promise<void> {
    const raw = await this.redis.get(key);
    if (!raw) return;
    const record: IdempotencyRecord = {
      ...(JSON.parse(raw) as IdempotencyRecord),
      status:      'completed',
      statusCode,
      body,
      completedAt: Date.now(),
    };
    await this.redis.setex(key, ttlSeconds, JSON.stringify(record));
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }
}
