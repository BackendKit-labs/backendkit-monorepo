import { isOk } from '@backendkit-labs/result';
import { RateLimiter } from '../../src/rate-limiter';
import { TokenBucketAlgorithm } from '../../src/algorithms';
import { ClockMock } from '../helpers/clock-mock';
import { IRateLimiterStore } from '../../src/interfaces/store.interface';
import { IAtomicConsumeStore, AtomicConsumeResult } from '../../src/stores/redis.store';

class AtomicStoreMock implements IRateLimiterStore, IAtomicConsumeStore {
  async get(): Promise<unknown | null> { return null; }
  async set(): Promise<void> {}
  async delete(): Promise<void> {}
  async clear(): Promise<void> {}

  async atomicConsume(
    _key: string,
    _weight: number,
    _now: number,
    _algorithmType: string,
    _algorithmConfig: Record<string, unknown>,
  ): Promise<AtomicConsumeResult> {
    return {
      allowed: true,
      remaining: 9,
      resetAt: 60_000,
      totalLimit: 10,
    };
  }
}

describe('RateLimiter - atomic consume path', () => {
  let clock: ClockMock;
  let store: AtomicStoreMock;
  let algorithm: TokenBucketAlgorithm;
  let limiter: RateLimiter;
  const CONFIG = { bucketSize: 10, tokensPerSecond: 5 };

  beforeEach(() => {
    clock = new ClockMock(1000);
    store = new AtomicStoreMock();
    algorithm = new TokenBucketAlgorithm();
    limiter = new RateLimiter(algorithm, store, clock, CONFIG, 'rl:', 'token-bucket');
  });

  it('should use atomicConsume when algorithmType and atomic store are provided', async () => {
    const result = await limiter.consume('user1');
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.allowed).toBe(true);
      expect(result.value.remaining).toBe(9);
      expect(result.value.totalLimit).toBe(10);
      expect(result.value.key).toBe('user1');
    }
  });

  it('should fallback to pessimistic path when no algorithmType', async () => {
    const nonAtomicLimiter = new RateLimiter(algorithm, store, clock, CONFIG, 'rl:', undefined);
    const result = await nonAtomicLimiter.consume('user1');
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.allowed).toBe(true);
    }
  });

  it('should fallback to pessimistic path when store lacks atomicConsume', async () => {
    const regularStore = new (class implements IRateLimiterStore {
      data = new Map<string, unknown>();
      async get(key: string) { return this.data.get(key) ?? null; }
      async set(key: string, state: unknown) { this.data.set(key, state); }
      async delete(key: string) { this.data.delete(key); }
      async clear() { this.data.clear(); }
    })();

    const noAtomicLimiter = new RateLimiter(algorithm, regularStore, clock, CONFIG, 'rl:', 'token-bucket');
    const result = await noAtomicLimiter.consume('user1');
    expect(isOk(result)).toBe(true);
  });
});
