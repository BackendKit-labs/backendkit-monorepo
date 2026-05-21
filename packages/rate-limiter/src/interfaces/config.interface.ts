import { IRateLimiterStore } from './store.interface';
import { IRateLimiterAlgorithm } from './algorithm.interface';
import { ILogger } from './logger.interface';
import { IMetricsRecorder } from './metrics.interface';

export type AlgorithmType =
  | 'token-bucket'
  | 'fixed-window'
  | 'sliding-window-log'
  | 'sliding-window-counter';

export type StoreType = 'memory' | 'redis';

export interface RateLimiterCircuitBreakerConfig {
  /** Percentage of failures to open the circuit (default 50) */
  failureThreshold?: number;
  /** Milliseconds to wait before transitioning OPEN → HALF_OPEN (default 30_000) */
  openTimeoutMs?: number;
  /** Minimum calls before evaluating thresholds (default 3) */
  minimumCalls?: number;
  /** Sliding window size (default 5) */
  slidingWindowSize?: number;
  /** When true (default), falls back to MemoryStore while the circuit is open */
  fallbackToMemory?: boolean;
  /** Called on every circuit state transition */
  onStateChange?: (from: string, to: string) => void;
}

export interface RateLimiterConfig {
  algorithm: AlgorithmType | IRateLimiterAlgorithm;
  store?: StoreType | IRateLimiterStore;
  redisOptions?: Record<string, unknown>;
  keyPrefix?: string;
  /** Circuit breaker for the Redis store. Has no effect when store is not 'redis'. */
  circuitBreaker?: RateLimiterCircuitBreakerConfig;
  /** Optional logger — satisfies ILogger structurally (e.g. @backendkit-labs/observability LoggerService) */
  logger?: ILogger;
  /** Optional metrics recorder — satisfies IMetricsRecorder structurally (e.g. @backendkit-labs/observability MetricsService) */
  metrics?: IMetricsRecorder;
}

export interface TokenBucketConfig extends RateLimiterConfig {
  algorithm: 'token-bucket';
  tokensPerSecond: number;
  bucketSize: number;
  initialTokens?: number;
}

export interface FixedWindowConfig extends RateLimiterConfig {
  algorithm: 'fixed-window';
  windowMs: number;
  maxRequests: number;
}

export interface SlidingWindowLogConfig extends RateLimiterConfig {
  algorithm: 'sliding-window-log';
  windowMs: number;
  maxRequests: number;
}

export interface SlidingWindowCounterConfig extends RateLimiterConfig {
  algorithm: 'sliding-window-counter';
  windowMs: number;
  maxRequests: number;
}
