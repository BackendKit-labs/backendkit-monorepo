import type { IdempotencyStore } from '../retry/types.js';

interface StoreEntry {
  value: string;
  expiresAt: number;
}

export class InMemoryIdempotencyStore implements IdempotencyStore {
  private store = new Map<string, StoreEntry>();

  get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return Promise.resolve(null);
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return Promise.resolve(null);
    }
    return Promise.resolve(entry.value);
  }

  set(key: string, value: string, ttlMs?: number): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs ?? 24 * 60 * 60 * 1000),
    });
    return Promise.resolve();
  }

  exists(key: string): Promise<boolean> {
    const entry = this.store.get(key);
    if (!entry) return Promise.resolve(false);
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return Promise.resolve(false);
    }
    return Promise.resolve(true);
  }
}
