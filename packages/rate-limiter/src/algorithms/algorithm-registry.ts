import { IRateLimiterAlgorithm } from '../interfaces/algorithm.interface';
import { TokenBucketAlgorithm } from './token-bucket.algorithm';
import { FixedWindowAlgorithm } from './fixed-window.algorithm';
import { SlidingWindowLogAlgorithm } from './sliding-window-log.algorithm';
import { SlidingWindowCounterAlgorithm } from './sliding-window-counter.algorithm';

const ALGORITHM_MAP: Record<string, new () => IRateLimiterAlgorithm> = {
  'token-bucket': TokenBucketAlgorithm,
  'fixed-window': FixedWindowAlgorithm,
  'sliding-window-log': SlidingWindowLogAlgorithm,
  'sliding-window-counter': SlidingWindowCounterAlgorithm,
};

export function resolveAlgorithm(name: string): IRateLimiterAlgorithm {
  const Ctor = ALGORITHM_MAP[name];
  if (!Ctor) {
    throw new Error(`Unknown algorithm: ${name}. Available: ${Object.keys(ALGORITHM_MAP).join(', ')}`);
  }
  return new Ctor();
}

export function getAvailableAlgorithms(): string[] {
  return Object.keys(ALGORITHM_MAP);
}
