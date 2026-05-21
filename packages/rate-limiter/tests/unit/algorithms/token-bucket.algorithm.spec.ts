import { TokenBucketAlgorithm, TokenBucketState } from '../../../src/algorithms';

describe('TokenBucketAlgorithm', () => {
  const CONFIG = {
    bucketSize: 10,
    tokensPerSecond: 5,
  };

  let algorithm: TokenBucketAlgorithm;

  beforeEach(() => {
    algorithm = new TokenBucketAlgorithm();
  });

  describe('name', () => {
    it('should return the algorithm name', () => {
      expect(algorithm.name).toBe('token-bucket');
    });
  });

  describe('initialState', () => {
    it('should create full bucket by default', () => {
      const state = algorithm.initialState(CONFIG as unknown as Record<string, unknown>, 1000);
      expect(state.tokens).toBe(10);
      expect(state.lastRefillTime).toBe(1000);
      expect(state.bucketSize).toBe(10);
      expect(state.tokensPerSecond).toBe(5);
    });

    it('should respect initialTokens config', () => {
      const state = algorithm.initialState(
        { ...CONFIG, initialTokens: 3 } as unknown as Record<string, unknown>,
        1000,
      );
      expect(state.tokens).toBe(3);
    });

    it('should cap initialTokens to bucketSize', () => {
      const state = algorithm.initialState(
        { ...CONFIG, initialTokens: 20 } as unknown as Record<string, unknown>,
        1000,
      );
      expect(state.tokens).toBe(10);
    });

    it('should use current time when now is undefined', () => {
      const before = Date.now();
      const state = algorithm.initialState(CONFIG as unknown as Record<string, unknown>);
      const after = Date.now();
      expect(state.lastRefillTime).toBeGreaterThanOrEqual(before);
      expect(state.lastRefillTime).toBeLessThanOrEqual(after);
    });
  });

  describe('consume', () => {
    it('should allow a request when tokens are available', () => {
      const state: TokenBucketState = { tokens: 10, lastRefillTime: 0, bucketSize: 10, tokensPerSecond: 5 };
      const result = algorithm.consume(state, 1, 0);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
    });

    it('should deny a request when tokens are insufficient', () => {
      const state: TokenBucketState = { tokens: 0, lastRefillTime: 0, bucketSize: 10, tokensPerSecond: 5 };
      const result = algorithm.consume(state, 1, 0);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should refill tokens based on elapsed time', () => {
      const state: TokenBucketState = { tokens: 0, lastRefillTime: 0, bucketSize: 10, tokensPerSecond: 5 };
      // 2 seconds elapsed -> 10 tokens refilled (refills 5/s, so 10 total, capped at 10)
      const result = algorithm.consume(state, 1, 2000);
      expect(result.allowed).toBe(true);
      // tokens = 0 + (2000/1000)*5 = 10, then -1 = 9
      expect(result.remaining).toBe(9);
    });

    it('should cap refill to bucketSize', () => {
      const state: TokenBucketState = { tokens: 5, lastRefillTime: 0, bucketSize: 10, tokensPerSecond: 5 };
      // 3 seconds elapsed -> 15 tokens added, capped at 10 -> total 10
      const result = algorithm.consume(state, 1, 3000);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
    });

    it('should handle weight > 1', () => {
      const state: TokenBucketState = { tokens: 10, lastRefillTime: 0, bucketSize: 10, tokensPerSecond: 5 };
      const result = algorithm.consume(state, 5, 0);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(5);
    });

    it('should deny when weight > available tokens even after refill', () => {
      const state: TokenBucketState = { tokens: 0, lastRefillTime: 0, bucketSize: 10, tokensPerSecond: 2 };
      // 1 second elapsed -> 2 tokens refilled, weight=5 > 2
      const result = algorithm.consume(state, 5, 1000);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should return correct resetAt when denied', () => {
      const state: TokenBucketState = { tokens: 0, lastRefillTime: 0, bucketSize: 10, tokensPerSecond: 10 };
      // 0s elapsed, 0 tokens, weight=1
      // timeToNextToken = (1/10)*1000 = 100ms
      const result = algorithm.consume(state, 1, 0);
      expect(result.allowed).toBe(false);
      expect(result.resetAt).toBe(100);
    });

    it('should return correct resetAt when allowed', () => {
      const state: TokenBucketState = { tokens: 5, lastRefillTime: 0, bucketSize: 10, tokensPerSecond: 10 };
      // consumed 1, tokens=4, bucketSize=10
      // resetAt = 0 + ((10-4)/10)*1000 = 600
      const result = algorithm.consume(state, 1, 0);
      expect(result.allowed).toBe(true);
      expect(result.resetAt).toBe(600);
    });

    it('should update lastRefillTime to now', () => {
      const state: TokenBucketState = { tokens: 5, lastRefillTime: 0, bucketSize: 10, tokensPerSecond: 5 };
      const result = algorithm.consume(state, 1, 5000);
      expect(result.state.lastRefillTime).toBe(5000);
    });

    it('should not mutate the original state object', () => {
      const state: TokenBucketState = { tokens: 5, lastRefillTime: 0, bucketSize: 10, tokensPerSecond: 5 };
      algorithm.consume(state, 1, 1000);
      expect(state.tokens).toBe(5);
      expect(state.lastRefillTime).toBe(0);
    });
  });

  describe('getLimit', () => {
    it('should return bucketSize', () => {
      const limit = algorithm.getLimit(CONFIG as unknown as Record<string, unknown>);
      expect(limit).toBe(10);
    });
  });
});
