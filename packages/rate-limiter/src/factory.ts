import { IRateLimiter } from './interfaces/rate-limiter.interface';
import { IRateLimiterAlgorithm } from './interfaces/algorithm.interface';
import { IRateLimiterStore } from './interfaces/store.interface';
import {
  RateLimiterConfig,
  RateLimiterCircuitBreakerConfig,
  AlgorithmType,
} from './interfaces/config.interface';
import { ILogger } from './interfaces/logger.interface';
import { resolveAlgorithm } from './algorithms/algorithm-registry';
import { createStore, createRedisStore } from './stores/store-registry';
import { RedisStoreOptions, CircuitBreakerLike } from './stores/redis.store';
import { MemoryStore } from './stores/memory.store';
import { RateLimiter } from './rate-limiter';
import { Clock, SystemClock } from './utils';

export class RateLimiterFactory {
  static create(config: RateLimiterConfig, clock?: Clock): IRateLimiter {
    const effectiveClock = clock ?? new SystemClock();

    const { algorithm, algorithmType } = RateLimiterFactory.resolveAlgorithm(config);
    const { store, fallbackStore } = RateLimiterFactory.resolveStore(config, effectiveClock);
    const algoConfig = RateLimiterFactory.extractConfig(config);

    return new RateLimiter(
      algorithm,
      store,
      effectiveClock,
      algoConfig,
      config.keyPrefix,
      algorithmType,
      fallbackStore,
      config.logger,
      config.metrics,
    );
  }

  private static resolveAlgorithm(config: RateLimiterConfig): {
    algorithm: IRateLimiterAlgorithm;
    algorithmType: string | undefined;
  } {
    if (typeof config.algorithm === 'object' && config.algorithm !== null) {
      return { algorithm: config.algorithm as IRateLimiterAlgorithm, algorithmType: undefined };
    }
    const algoName = config.algorithm as AlgorithmType;
    return {
      algorithm: resolveAlgorithm(algoName),
      algorithmType: algoName,
    };
  }

  private static resolveStore(
    config: RateLimiterConfig,
    clock: Clock,
  ): { store: IRateLimiterStore; fallbackStore?: IRateLimiterStore } {
    if (typeof config.store === 'object' && config.store !== null) {
      return { store: config.store as IRateLimiterStore };
    }

    const storeName = config.store ?? 'memory';

    if (storeName === 'redis') {
      const cbInstance = config.circuitBreaker
        ? RateLimiterFactory.buildCircuitBreaker(config.circuitBreaker, config.logger)
        : undefined;

      const store = createRedisStore({
        ...(config.redisOptions as RedisStoreOptions | undefined),
        circuitBreaker: cbInstance,
      });

      let fallbackStore: IRateLimiterStore | undefined;
      if (config.circuitBreaker && config.circuitBreaker.fallbackToMemory !== false) {
        fallbackStore = new MemoryStore(clock);
      }

      return { store, fallbackStore };
    }

    return { store: createStore(storeName, clock) };
  }

  private static buildCircuitBreaker(
    cbConfig: RateLimiterCircuitBreakerConfig,
    logger?: ILogger,
  ): CircuitBreakerLike {
    let cbModule: { CircuitBreaker: new(config: Record<string, unknown>) => CircuitBreakerLike };
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      cbModule = require('@backendkit-labs/circuit-breaker') as typeof cbModule;
    } catch {
      throw new Error(
        '@backendkit-labs/circuit-breaker is required when circuitBreaker config is set. ' +
        'Install it: npm install @backendkit-labs/circuit-breaker',
      );
    }

    return new cbModule.CircuitBreaker({
      name: 'rate-limiter:redis',
      failureThreshold: cbConfig.failureThreshold ?? 50,
      openTimeoutMs: cbConfig.openTimeoutMs ?? 30_000,
      minimumCalls: cbConfig.minimumCalls ?? 3,
      slidingWindowSize: cbConfig.slidingWindowSize ?? 5,
      halfOpenMaxCalls: 1,
      isFailure: () => true,
      onStateChange: (
        from: string,
        to: string,
        metrics: Record<string, unknown>,
      ) => {
        logger?.warn(
          `Redis circuit breaker: ${from} → ${to} (failed calls: ${String(metrics['failedCalls'])})`,
          'RateLimiter:CircuitBreaker',
        );
        cbConfig.onStateChange?.(from, to);
      },
    });
  }

  private static extractConfig(config: RateLimiterConfig): Record<string, unknown> {
    const {
      algorithm: _algo,
      store: _store,
      keyPrefix: _prefix,
      redisOptions: _redis,
      circuitBreaker: _cb,
      logger: _logger,
      metrics: _metrics,
      ...rest
    } = config as unknown as Record<string, unknown>;
    return rest;
  }
}
