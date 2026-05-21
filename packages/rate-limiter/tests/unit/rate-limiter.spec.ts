import { vi } from 'vitest';
import { isOk, isFail } from '@backendkit-labs/result';
import { RateLimiter } from '../../src/rate-limiter';
import { TokenBucketAlgorithm } from '../../src/algorithms';
import { StoreError } from '../../src/errors';
import { ClockMock } from '../helpers/clock-mock';
import { StoreMock } from '../helpers/store-mock';

describe('RateLimiter', () => {
  let clock: ClockMock;
  let store: StoreMock;
  let algorithm: TokenBucketAlgorithm;
  let limiter: RateLimiter;
  const CONFIG = { bucketSize: 10, tokensPerSecond: 5 };

  beforeEach(() => {
    clock = new ClockMock(1000);
    store = new StoreMock();
    algorithm = new TokenBucketAlgorithm();
    limiter = new RateLimiter(algorithm, store, clock, CONFIG, 'rl:', 'token-bucket');
  });

  describe('consume', () => {
    it('should return allowed=true for a valid request', async () => {
      const result = await limiter.consume('user1');
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.allowed).toBe(true);
        expect(result.value.key).toBe('user1');
        expect(result.value.totalLimit).toBe(10);
      }
    });

    it('should return allowed=false when rate limit is exceeded', async () => {
      // Consume all tokens (10 requests with weight=1 each)
      for (let i = 0; i < 10; i++) {
        await limiter.consume('user1');
      }

      const result = await limiter.consume('user1');
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.allowed).toBe(false);
        expect(result.value.remaining).toBe(0);
      }
    });

    it('should handle weight > 1', async () => {
      const result = await limiter.consume('user1', 5);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.allowed).toBe(true);
        expect(result.value.remaining).toBe(5);
      }
    });

    it('should refill tokens over time', async () => {
      // Exhaust tokens
      for (let i = 0; i < 10; i++) {
        await limiter.consume('user1');
      }

      // Advance 2 seconds => 10 tokens refilled
      clock.advance(2000);

      const result = await limiter.consume('user1');
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.allowed).toBe(true);
        expect(result.value.remaining).toBe(9);
      }
    });

    it('should use store and algorithm to process request', async () => {
      const result = await limiter.consume('user1', 1);

      expect(isOk(result)).toBe(true);
      // Store should have the key now
      expect(store.has('rl:token-bucket:user1')).toBe(true);
    });

    it('should return a Result with key and totalLimit on success', async () => {
      const result = await limiter.consume('user1');

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.key).toBe('user1');
        expect(result.value.totalLimit).toBe(10);
        expect(typeof result.value.remaining).toBe('number');
        expect(typeof result.value.resetAt).toBe('number');
      }
    });
  });

  describe('consume - error handling', () => {
    it('should return a StoreError when store.get throws', async () => {
      const failingStore = new StoreMock();
      vi.spyOn(failingStore, 'get').mockRejectedValue(new Error('DB connection lost'));

      const badLimiter = new RateLimiter(algorithm, failingStore, clock, CONFIG, 'rl:', 'token-bucket');
      const result = await badLimiter.consume('user1');

      expect(isFail(result)).toBe(true);
      if (isFail(result)) {
        expect(result.error).toBeInstanceOf(StoreError);
        expect(result.error.message).toBe('Failed to consume rate limit token');
      }
    });

    it('should return a StoreError when store.set throws', async () => {
      const failingStore = new StoreMock();
      vi.spyOn(failingStore, 'set').mockRejectedValue(new Error('Write failed'));

      const badLimiter = new RateLimiter(algorithm, failingStore, clock, CONFIG, 'rl:', 'token-bucket');
      const result = await badLimiter.consume('user1');

      expect(isFail(result)).toBe(true);
      if (isFail(result)) {
        expect(result.error).toBeInstanceOf(StoreError);
      }
    });
  });

  describe('check', () => {
    it('should return current state without consuming', async () => {
      const result = await limiter.check('user1');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(10);
    });

    it('should return reduced remaining after some requests', async () => {
      await limiter.consume('user1');
      await limiter.consume('user1');
      await limiter.consume('user1');

      const result = await limiter.check('user1');
      expect(result.remaining).toBe(7);
    });

    it('should return the key and totalLimit', async () => {
      const result = await limiter.check('user1');
      expect(result.key).toBe('user1');
      expect(result.totalLimit).toBe(10);
    });
  });

  describe('reset', () => {
    it('should reset a specific key', async () => {
      await limiter.consume('user1');
      expect(store.has('rl:token-bucket:user1')).toBe(true);
      // Also consume user2 to verify it's not affected
      await limiter.consume('user2');
      expect(store.has('rl:token-bucket:user2')).toBe(true);

      await limiter.reset('user1');
      expect(store.has('rl:token-bucket:user1')).toBe(false);
      expect(store.has('rl:token-bucket:user2')).toBe(true);
    });

    it('should not throw when resetting non-existent key', async () => {
      await expect(limiter.reset('nonexistent')).resolves.not.toThrow();
    });

    it('should allow requests after reset', async () => {
      // Exhaust
      for (let i = 0; i < 10; i++) {
        await limiter.consume('user1');
      }
      let result = await limiter.consume('user1');
      expect(isOk(result)).toBe(true);
      if (isOk(result)) expect(result.value.allowed).toBe(false);

      // Reset
      await limiter.reset('user1');

      result = await limiter.consume('user1');
      expect(isOk(result)).toBe(true);
      if (isOk(result)) expect(result.value.allowed).toBe(true);
    });
  });

  describe('resetAll', () => {
    it('should clear all keys', async () => {
      await limiter.consume('user1');
      await limiter.consume('user2');
      await limiter.consume('user3');

      expect(store.size).toBe(3);

      await limiter.resetAll();
      expect(store.size).toBe(0);
    });

    it('should allow requests after resetAll', async () => {
      await limiter.consume('user1');
      await limiter.resetAll();

      const result = await limiter.consume('user1');
      expect(isOk(result)).toBe(true);
      if (isOk(result)) expect(result.value.allowed).toBe(true);
    });

    it('should not throw on empty store', async () => {
      await expect(limiter.resetAll()).resolves.not.toThrow();
    });
  });

  describe('with custom algorithm (no algorithmType)', () => {
    it('should work without algorithmType (custom algorithm, no atomic path)', async () => {
      const customLimiter = new RateLimiter(algorithm, store, clock, CONFIG, 'rl:', undefined);
      const result = await customLimiter.consume('user1');
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.allowed).toBe(true);
      }
    });
  });
});
