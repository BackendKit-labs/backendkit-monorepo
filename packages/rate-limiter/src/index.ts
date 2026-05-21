// Public barrel - punto de entrada del paquete
export { IRateLimiter } from './interfaces/rate-limiter.interface';
export { IRateLimiterAlgorithm, ConsumeResult } from './interfaces/algorithm.interface';
export { IRateLimiterStore } from './interfaces/store.interface';
export {
  RateLimiterConfig,
  RateLimiterCircuitBreakerConfig,
  AlgorithmType,
  StoreType,
  TokenBucketConfig,
  FixedWindowConfig,
  SlidingWindowLogConfig,
  SlidingWindowCounterConfig,
} from './interfaces/config.interface';
export { ILogger } from './interfaces/logger.interface';
export { IMetricsRecorder } from './interfaces/metrics.interface';
export { RateLimitResult } from './interfaces/result.interface';
export { RateLimitError, StoreError, AlgorithmError, ConfigError } from './errors';
export { Clock, SystemClock, isPositiveInt, delay } from './utils';
export { MemoryStore } from './stores';
export {
  RedisStore,
  RedisStoreOptions,
  CircuitBreakerLike,
  AtomicConsumeResult,
  IAtomicConsumeStore,
  supportsAtomicConsume,
  createRedisStore,
} from './stores';
export {
  TokenBucketAlgorithm,
  TokenBucketState,
  FixedWindowAlgorithm,
  FixedWindowState,
  SlidingWindowLogAlgorithm,
  SlidingWindowLogState,
  SlidingWindowCounterAlgorithm,
  SlidingWindowCounterState,
  resolveAlgorithm,
  getAvailableAlgorithms,
} from './algorithms';
export { RateLimiter } from './rate-limiter';
export { RateLimiterFactory } from './factory';
export { calculateDecay, calculateRemaining } from './token-counter';

// Result monad - re-export directo del paquete oficial
export type { Result } from './utils';
export { ok, fail } from './utils';

// NestJS integration - requires @nestjs/common as peer dependency
export {
  RateLimit,
  RateLimitOptions,
  RATE_LIMIT_KEY,
} from './nestjs/rate-limiter.decorator';
export {
  RateLimiterGuard,
  RATE_LIMITER_INSTANCE,
  RATE_LIMITER_LOGGER,
  RATE_LIMITER_METRICS,
} from './nestjs/rate-limiter.guard';
export {
  RateLimiterModule,
  RateLimiterModuleOptions,
  RateLimiterModuleAsyncOptions,
} from './nestjs/rate-limiter.module';
