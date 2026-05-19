import { Injectable } from '@nestjs/common';
import type { IdempotencyRecord } from '../idempotency.types.js';
import type { IdempotencyStore } from './idempotency-store.interface.js';

interface Entry {
  record:    IdempotencyRecord;
  expiresAt: number;
}

@Injectable()
export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly map = new Map<string, Entry>();

  async setIfAbsent(record: IdempotencyRecord, ttlSeconds: number): Promise<IdempotencyRecord | null> {
    this.evict();
    const existing = this.map.get(record.key);
    if (existing) return existing.record;
    this.map.set(record.key, {
      record,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
    return null;
  }

  async get(key: string): Promise<IdempotencyRecord | null> {
    this.evict();
    return this.map.get(key)?.record ?? null;
  }

  async complete(key: string, statusCode: number, body: unknown, ttlSeconds: number): Promise<void> {
    const entry = this.map.get(key);
    if (!entry) return;
    entry.record = {
      ...entry.record,
      status:      'completed',
      statusCode,
      body,
      completedAt: Date.now(),
    };
    entry.expiresAt = Date.now() + ttlSeconds * 1000;
  }

  async delete(key: string): Promise<void> {
    this.map.delete(key);
  }

  private evict(): void {
    const now = Date.now();
    for (const [k, e] of this.map) {
      if (e.expiresAt <= now) this.map.delete(k);
    }
  }
}
