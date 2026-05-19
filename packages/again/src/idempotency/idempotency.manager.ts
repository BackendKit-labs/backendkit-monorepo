import type { IdempotencyConfig, IdempotencyStore } from '../again/types.js';
import { InMemoryIdempotencyStore } from './memory.store.js';

export class IdempotencyManager {
  private store: IdempotencyStore;

  constructor(private config: IdempotencyConfig) {
    this.store = config.store ?? new InMemoryIdempotencyStore();
  }

  /**
   * Generate an idempotency key from the request context.
   */
  generateKey(method: string, path: string, bodyHash?: string): string {
    return `${method}:${path}:${bodyHash ?? ''}`;
  }

  /**
   * Check if a key already exists in the store.
   */
  async hasResult(key: string): Promise<boolean> {
    return this.store.exists(key);
  }

  /**
   * Store a result for a given key.
   */
  async storeResult(key: string, result: string): Promise<void> {
    await this.store.set(key, result, this.config.ttlMs);
  }

  /**
   * Retrieve a stored result.
   */
  async getResult(key: string): Promise<string | null> {
    return this.store.get(key);
  }

  /**
   * Check if the HTTP method should be idempotent.
   */
  isIdempotentMethod(method: string): boolean {
    return this.config.idempotentMethods.includes(method.toUpperCase());
  }
}
