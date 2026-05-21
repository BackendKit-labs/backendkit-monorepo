import Redis, { Redis as RedisClient, Cluster } from 'ioredis';
import { IRateLimiterStore } from '../interfaces/store.interface';
import { CONSUME_SCRIPT } from './redis-lua';

/** Minimal duck-type for circuit breaker — satisfied by @backendkit-labs/circuit-breaker */
export interface CircuitBreakerLike {
  execute<T>(task: () => Promise<T>, fallback?: (error: unknown) => T | Promise<T>): Promise<T>;
}

export interface RedisStoreOptions {
  client?: RedisClient | Cluster;
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  enableAutoPipelining?: boolean;
  maxRetriesPerRequest?: number;
  retryStrategy?: (times: number) => number | null;
  /** Pre-built circuit breaker instance. When open, all Redis calls throw immediately. */
  circuitBreaker?: CircuitBreakerLike;
}

export interface AtomicConsumeResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  totalLimit: number;
}

// Extra interface for stores that support atomic consume
export interface IAtomicConsumeStore extends IRateLimiterStore {
  atomicConsume(
    key: string,
    weight: number,
    now: number,
    algorithmType: string,
    algorithmConfig: Record<string, unknown>,
  ): Promise<AtomicConsumeResult>;
}

export class RedisStore implements IRateLimiterStore<unknown>, IAtomicConsumeStore {
  private readonly client: RedisClient | Cluster;
  private scriptSha: string | undefined;
  private readonly opts: RedisStoreOptions;
  private readonly circuitBreaker?: CircuitBreakerLike;

  constructor(options?: RedisStoreOptions) {
    this.opts = options ?? {};
    this.circuitBreaker = options?.circuitBreaker;
    if (this.opts.client) {
      this.client = this.opts.client;
    } else {
      this.client = new Redis({
        host: this.opts.host ?? 'localhost',
        port: this.opts.port ?? 6379,
        password: this.opts.password,
        db: this.opts.db ?? 0,
        keyPrefix: this.opts.keyPrefix,
        enableAutoPipelining: this.opts.enableAutoPipelining ?? true,
        maxRetriesPerRequest: this.opts.maxRetriesPerRequest,
        retryStrategy: this.opts.retryStrategy,
        lazyConnect: false,
      });
    }
  }

  /**
   * Load the Lua script into Redis and cache the SHA.
   */
  async ensureScriptLoaded(): Promise<string> {
    if (this.scriptSha) return this.scriptSha;
    try {
      const sha = await (this.client as RedisClient).script('LOAD', CONSUME_SCRIPT);
      this.scriptSha = typeof sha === 'string' && sha.length > 0 ? sha : undefined;
      if (!this.scriptSha) {
        throw new Error('Received empty SHA from SCRIPT LOAD');
      }
      return this.scriptSha;
    } catch (error) {
      throw new Error(`Failed to load Lua script into Redis: ${(error as Error).message}`);
    }
  }

  /**
   * Atomic consume using Lua EVALSHA with EVAL fallback.
   */
  async atomicConsume(
    key: string,
    weight: number,
    now: number,
    algorithmType: string,
    algorithmConfig: Record<string, unknown>,
  ): Promise<AtomicConsumeResult> {
    if (this.circuitBreaker) {
      return this.circuitBreaker.execute(() =>
        this._rawAtomicConsume(key, weight, now, algorithmType, algorithmConfig),
      );
    }
    return this._rawAtomicConsume(key, weight, now, algorithmType, algorithmConfig);
  }

  private async _rawAtomicConsume(
    key: string,
    weight: number,
    now: number,
    algorithmType: string,
    algorithmConfig: Record<string, unknown>,
  ): Promise<AtomicConsumeResult> {
    const sha = await this.ensureScriptLoaded();
    const args: (string | number)[] = [
      String(weight),
      String(now),
      algorithmType,
      JSON.stringify(algorithmConfig),
    ];

    let raw: (number | string)[];

    try {
      raw = (await (this.client as RedisClient).evalsha(sha, 1, key, ...args)) as (number | string)[];
    } catch (err: unknown) {
      const redisErr = err as { message?: string };
      // If script not found (e.g. Redis restart or SCRIPT FLUSH), fall back to EVAL
      if (redisErr?.message && redisErr.message.includes('NOSCRIPT')) {
        this.scriptSha = undefined; // reset cache so next call reloads
        raw = (await (this.client as RedisClient).eval(CONSUME_SCRIPT, 1, key, ...args)) as (number | string)[];
      } else {
        throw err;
      }
    }

    return {
      allowed: Number(raw[0]) === 1,
      remaining: Number(raw[1]),
      resetAt: Number(raw[2]),
      totalLimit: Number(raw[3]),
    };
  }

  // ---- Standard IRateLimiterStore interface ----

  async get(key: string): Promise<unknown | null> {
    if (this.circuitBreaker) {
      return this.circuitBreaker.execute(() => this._rawGet(key));
    }
    return this._rawGet(key);
  }

  async set(key: string, state: unknown, ttlMs?: number): Promise<void> {
    if (this.circuitBreaker) {
      return this.circuitBreaker.execute(() => this._rawSet(key, state, ttlMs));
    }
    return this._rawSet(key, state, ttlMs);
  }

  async delete(key: string): Promise<void> {
    if (this.circuitBreaker) {
      return this.circuitBreaker.execute(() => this._rawDelete(key));
    }
    return this._rawDelete(key);
  }

  async clear(): Promise<void> {
    if (this.circuitBreaker) {
      return this.circuitBreaker.execute(() => this._rawClear());
    }
    return this._rawClear();
  }

  private async _rawGet(key: string): Promise<unknown | null> {
    const raw = await this.client.get(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw as string);
    } catch {
      return raw;
    }
  }

  private async _rawSet(key: string, state: unknown, ttlMs?: number): Promise<void> {
    const serialized = JSON.stringify(state);
    if (ttlMs && ttlMs > 0) {
      const ttlSeconds = Math.ceil(ttlMs / 1000);
      await (this.client as RedisClient).set(key, serialized, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, serialized);
    }
  }

  private async _rawDelete(key: string): Promise<void> {
    await this.client.del(key);
  }

  private async _rawClear(): Promise<void> {
    await (this.client as RedisClient).flushdb();
  }

  /**
   * Disconnect the Redis client. Call this on application shutdown.
   */
  disconnect(): void {
    this.client.disconnect();
  }

  /**
   * Get the underlying Redis client (for advanced use).
   */
  getClient(): RedisClient | Cluster {
    return this.client;
  }
}

// Helper to check if a store supports atomic consume
export function supportsAtomicConsume(store: IRateLimiterStore): store is IAtomicConsumeStore {
  return 'atomicConsume' in store;
}
