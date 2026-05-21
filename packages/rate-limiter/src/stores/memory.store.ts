import { IRateLimiterStore } from '../interfaces/store.interface';
import { Clock, SystemClock } from '../utils';

export class MemoryStore implements IRateLimiterStore<unknown> {
  private readonly store = new Map<string, { state: unknown; expiresAt: number }>();
  private readonly clock: Clock;
  private readonly maxSize: number;

  constructor(clock?: Clock, maxSize?: number) {
    this.clock = clock ?? new SystemClock();
    this.maxSize = maxSize ?? 0; // 0 = unlimited
  }

  get(key: string): Promise<unknown | null> {
    const entry = this.store.get(key);
    if (!entry) return Promise.resolve(null);
    if (entry.expiresAt > 0 && this.clock.now() > entry.expiresAt) {
      this.store.delete(key);
      return Promise.resolve(null);
    }
    return Promise.resolve(entry.state);
  }

  set(key: string, state: unknown, ttlMs?: number): Promise<void> {
    if (this.maxSize > 0 && this.store.size >= this.maxSize) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey);
      }
    }
    const expiresAt = ttlMs ? this.clock.now() + ttlMs : 0;
    this.store.set(key, { state, expiresAt });
    return Promise.resolve();
  }

  delete(key: string): Promise<void> {
    this.store.delete(key);
    return Promise.resolve();
  }

  clear(): Promise<void> {
    this.store.clear();
    return Promise.resolve();
  }

  get size(): number {
    return this.store.size;
  }
}
