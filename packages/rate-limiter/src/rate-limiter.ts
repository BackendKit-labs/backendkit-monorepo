import { Result, ok, fail } from '@backendkit-labs/result';
import { IRateLimiter } from './interfaces/rate-limiter.interface';
import { IRateLimiterAlgorithm } from './interfaces/algorithm.interface';
import { IRateLimiterStore } from './interfaces/store.interface';
import { RateLimitResult } from './interfaces/result.interface';
import { RateLimitError, StoreError, ConfigError } from './errors/rate-limit-error';
import { ILogger } from './interfaces/logger.interface';
import { IMetricsRecorder } from './interfaces/metrics.interface';
import { Clock } from './utils';
import { supportsAtomicConsume, IAtomicConsumeStore } from './stores/redis.store';

export class RateLimiter implements IRateLimiter {
  constructor(
    private readonly algorithm: IRateLimiterAlgorithm,
    private readonly store: IRateLimiterStore,
    private readonly clock: Clock,
    private readonly config: Record<string, unknown>,
    private readonly keyPrefix: string = 'rl:',
    private readonly algorithmType?: string,
    private readonly fallbackStore?: IRateLimiterStore,
    private readonly logger?: ILogger,
    private readonly metrics?: IMetricsRecorder,
  ) {}

  async consume(key: string, weight: number = 1): Promise<Result<RateLimitResult, RateLimitError>> {
    if (typeof weight !== 'number' || !Number.isInteger(weight) || weight < 1) {
      return fail(new ConfigError(`"weight" must be a positive integer, got ${String(weight)}`));
    }

    const result = await this.executeConsume(this.store, key, weight);

    if (!result.ok && result.error instanceof StoreError && this.fallbackStore) {
      this.logger?.warn(
        `Primary store failed for key "${key}", falling back to secondary store`,
        'RateLimiter',
      );
      const fallbackResult = await this.executeConsume(this.fallbackStore, key, weight);
      this.observe(key, fallbackResult, true);
      return fallbackResult;
    }

    this.observe(key, result, false);
    return result;
  }

  private async executeConsume(
    store: IRateLimiterStore,
    key: string,
    weight: number,
  ): Promise<Result<RateLimitResult, RateLimitError>> {
    try {
      if (this.algorithmType && supportsAtomicConsume(store)) {
        return await this.atomicConsume(key, weight, store as unknown as IAtomicConsumeStore);
      }
      return await this.pessimisticConsume(key, weight, store);
    } catch (error) {
      return fail(new StoreError('Failed to consume rate limit token', error));
    }
  }

  private async atomicConsume(
    key: string,
    weight: number,
    store: IAtomicConsumeStore,
  ): Promise<Result<RateLimitResult, RateLimitError>> {
    const now = this.clock.now();
    const fullKey = this.buildKey(key);

    const result = await store.atomicConsume(fullKey, weight, now, this.algorithmType!, this.config);

    return ok({
      key,
      allowed: result.allowed,
      remaining: result.remaining,
      resetAt: result.resetAt,
      totalLimit: result.totalLimit,
    });
  }

  private async pessimisticConsume(
    key: string,
    weight: number,
    store: IRateLimiterStore,
  ): Promise<Result<RateLimitResult, RateLimitError>> {
    const now = this.clock.now();
    const fullKey = this.buildKey(key);

    const state = await store.get(fullKey);
    const currentState = state ?? this.algorithm.initialState(this.config, now);

    const result = this.algorithm.consume(currentState, weight, now);

    const ttlMs = this.calculateTtl(result, now);
    await store.set(fullKey, result.state, ttlMs);

    return ok({
      key,
      allowed: result.allowed,
      remaining: result.remaining,
      resetAt: result.resetAt,
      totalLimit: this.algorithm.getLimit(this.config),
    });
  }

  private observe(
    key: string,
    result: Result<RateLimitResult, RateLimitError>,
    usingFallback: boolean,
  ): void {
    const algorithm = this.algorithmType ?? 'custom';

    if (!result.ok) {
      this.metrics?.record('rate_limiter.error', 1, { tags: { algorithm } });
      this.logger?.error(
        `Store error for key "${key}": ${result.error.message}`,
        undefined,
        'RateLimiter',
      );
      return;
    }

    const tags: Record<string, string> = {
      algorithm,
      allowed: String(result.value.allowed),
    };
    if (usingFallback) tags['store'] = 'fallback';

    this.metrics?.record('rate_limiter.consume', 1, { tags });

    if (!result.value.allowed) {
      this.logger?.warn(
        `Rate limit exceeded for key "${key}" (remaining: ${result.value.remaining}/${result.value.totalLimit})`,
        'RateLimiter',
      );
    }
  }

  async check(key: string): Promise<RateLimitResult> {
    const now = this.clock.now();
    const fullKey = this.buildKey(key);

    const state = await this.store.get(fullKey);
    const currentState = state ?? this.algorithm.initialState(this.config, now);

    const result = this.algorithm.consume(currentState, 0, now);

    return {
      key,
      allowed: result.allowed,
      remaining: result.remaining,
      resetAt: result.resetAt,
      totalLimit: this.algorithm.getLimit(this.config),
    };
  }

  async reset(key: string): Promise<void> {
    const fullKey = this.buildKey(key);
    await this.store.delete(fullKey);
  }

  async resetAll(): Promise<void> {
    await this.store.clear();
  }

  private buildKey(key: string): string {
    return `${this.keyPrefix}${this.algorithm.name}:${key}`;
  }

  private calculateTtl(result: { resetAt: number }, now: number): number {
    return Math.max(result.resetAt - now, 1000);
  }
}
