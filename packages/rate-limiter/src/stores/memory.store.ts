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

  async get(key: string): Promise<unknown | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt > 0 && this.clock.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.state;
  }

  async set(key: string, state: unknown, ttlMs?: number): Promise<void> {
    // Evict oldest entry if at capacity (only when maxSize > 0)
    if (this.maxSize > 0 && this.store.size >= this.maxSize) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey);
      }
    }
    const expiresAt = ttlMs ? this.clock.now() + ttlMs : 0;
    this.store.set(key, { state, expiresAt });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}
