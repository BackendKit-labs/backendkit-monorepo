import type { IdempotencyRecord } from '../idempotency.types.js';

export interface IdempotencyStore {
  /**
   * Atomically insert a pending record if no record exists for `key`.
   * Returns the existing record if one was already present, or `null` if the
   * insert succeeded (this is the first time we see this key).
   */
  setIfAbsent(record: IdempotencyRecord, ttlSeconds: number): Promise<IdempotencyRecord | null>;

  get(key: string): Promise<IdempotencyRecord | null>;

  complete(key: string, statusCode: number, body: unknown, ttlSeconds: number): Promise<void>;

  /** Remove the record — called when handler throws so the key can be retried. */
  delete(key: string): Promise<void>;
}
