import { IRateLimiterStore } from '../../src/interfaces/store.interface';

export class StoreMock implements IRateLimiterStore<unknown> {
  private data = new Map<string, unknown>();

  async get(key: string): Promise<unknown | null> {
    return this.data.get(key) ?? null;
  }

  async set(key: string, state: unknown, _ttlMs?: number): Promise<void> {
    this.data.set(key, state);
  }

  async delete(key: string): Promise<void> {
    this.data.delete(key);
  }

  async clear(): Promise<void> {
    this.data.clear();
  }

  get size(): number {
    return this.data.size;
  }

  has(key: string): boolean {
    return this.data.has(key);
  }
}
