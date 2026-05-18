import { ok, fail } from '@backendkit-labs/result';
import type { Result } from '@backendkit-labs/result';
import { InMemoryStorage } from '../core/persistence/in-memory-storage.js';
import type { TunableConfig } from '../core/types.js';
import type { LearningError } from '../core/errors.js';
import { storageError } from '../core/errors.js';

/**
 * Minimal Redis interface satisfied by both `redis` v4 and `ioredis`.
 *
 * ioredis uses lowercase `setex` — pass an adapter object if needed:
 * ```ts
 * const client: RedisClient = {
 *   get:   (k)          => ioRedis.get(k),
 *   set:   (k, v)       => ioRedis.set(k, v),
 *   setEx: (k, ttl, v)  => ioRedis.setex(k, ttl, v),
 * };
 * ```
 */
export interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
  setEx?(key: string, seconds: number, value: string): Promise<unknown>;
}

export type RedisStorageAdapterOptions = {
  /** Prefix applied to all Redis keys. Default: `'auto-learning:'` */
  keyPrefix?: string;
  /** TTL for the config key in seconds. Default: `2_592_000` (30 days) */
  configTtlSeconds?: number;
};

const CONFIG_SUFFIX = 'config';

/**
 * StorageAdapter backed by Redis for `TunableConfig` persistence.
 *
 * Patterns, anomalies, and cycle events remain in-memory per process (same as
 * InMemoryStorage). Only TunableConfig is shared across instances via Redis,
 * which is enough for multi-instance tuning convergence.
 *
 * Startup sequence:
 * ```ts
 * const storage = new RedisStorageAdapter(redisClient);
 * await storage.loadConfigAsync(); // seed in-memory from Redis before starting
 *
 * const core = AutoLearningCore.create({ storage });
 * core.startFeedbackLoop();
 * ```
 */
export class RedisStorageAdapter extends InMemoryStorage {
  private readonly configKey: string;
  private readonly configTtl: number;

  constructor(
    private readonly client: RedisClient,
    options: RedisStorageAdapterOptions = {},
  ) {
    super();
    const prefix    = options.keyPrefix        ?? 'auto-learning:';
    this.configKey  = prefix + CONFIG_SUFFIX;
    this.configTtl  = options.configTtlSeconds ?? 2_592_000;
  }

  /**
   * Persists config to in-memory (synchronous, used by the feedback loop) and
   * fires an async write to Redis. Redis failures are silently ignored — the
   * in-memory config remains valid and the next save will retry.
   */
  override saveConfig(config: TunableConfig): Result<void, LearningError> {
    const inMemResult = super.saveConfig(config);
    if (!inMemResult.ok) return inMemResult;

    const serialized = JSON.stringify(config);
    const writePromise = this.client.setEx
      ? this.client.setEx(this.configKey, this.configTtl, serialized)
      : this.client.set(this.configKey, serialized);

    writePromise.catch(() => {
      // Redis write failure — in-memory config is still valid.
    });

    return inMemResult;
  }

  /**
   * Returns the in-memory config synchronously (required by StorageAdapter).
   * Use `loadConfigAsync()` at startup to seed in-memory state from Redis first.
   */
  override loadConfig(): Result<TunableConfig | null, LearningError> {
    return super.loadConfig();
  }

  /**
   * Reads TunableConfig from Redis and seeds the in-memory store.
   * Call once at application startup before the feedback loop starts.
   */
  async loadConfigAsync(): Promise<Result<TunableConfig | null, LearningError>> {
    try {
      const raw = await this.client.get(this.configKey);
      if (raw === null) return ok(null);

      const config = JSON.parse(raw) as TunableConfig;
      super.saveConfig(config);
      return ok(config);
    } catch (e) {
      return fail(storageError('Failed to load config from Redis', e));
    }
  }
}
