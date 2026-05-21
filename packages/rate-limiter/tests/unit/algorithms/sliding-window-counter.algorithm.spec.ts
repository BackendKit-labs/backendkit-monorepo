import { SlidingWindowCounterAlgorithm, SlidingWindowCounterState } from '../../../src/algorithms';

describe('SlidingWindowCounterAlgorithm', () => {
  const CONFIG = { windowMs: 60_000, maxRequests: 10 };
  let algorithm: SlidingWindowCounterAlgorithm;

  beforeEach(() => {
    algorithm = new SlidingWindowCounterAlgorithm();
  });

  describe('name', () => {
    it('should return the algorithm name', () => {
      expect(algorithm.name).toBe('sliding-window-counter');
    });
  });

  describe('initialState', () => {
    it('should create initial state at window boundary', () => {
      const before = Date.now();
      const state = algorithm.initialState(CONFIG as unknown as Record<string, unknown>);
      const after = Date.now();

      expect(state.currentCount).toBe(0);
      expect(state.previousCount).toBe(0);
      expect(state.windowMs).toBe(60_000);
      expect(state.maxRequests).toBe(10);
      expect(state.currentWindowStart).toBeGreaterThanOrEqual(Math.floor(before / 60_000) * 60_000);
      expect(state.currentWindowStart).toBeLessThanOrEqual(Math.floor(after / 60_000) * 60_000);
      expect(state.previousWindowStart).toBe(state.currentWindowStart - 60_000);
    });

    it('should accept explicit now parameter', () => {
      const state = algorithm.initialState(CONFIG as unknown as Record<string, unknown>, 123_456);
      expect(state.currentWindowStart).toBe(Math.floor(123_456 / 60_000) * 60_000);
    });
  });

  describe('consume', () => {
    it('should allow first request', () => {
      const state: SlidingWindowCounterState = {
        currentWindowStart: 0,
        currentCount: 0,
        previousWindowStart: -60_000,
        previousCount: 0,
        windowMs: 60_000,
        maxRequests: 10,
      };
      const result = algorithm.consume(state, 1, 1000);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
      expect(result.state.currentCount).toBe(1);
    });

    it('should allow requests up to maxRequests', () => {
      const state: SlidingWindowCounterState = {
        currentWindowStart: 0,
        currentCount: 9,
        previousWindowStart: -60_000,
        previousCount: 0,
        windowMs: 60_000,
        maxRequests: 10,
      };
      // estimated = 9 + 0 * (1 - 1000/60000) = 9, 9+1 <= 10
      const result = algorithm.consume(state, 1, 1000);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(0);
      expect(result.state.currentCount).toBe(10);
    });

    it('should deny when at capacity', () => {
      const state: SlidingWindowCounterState = {
        currentWindowStart: 0,
        currentCount: 10,
        previousWindowStart: -60_000,
        previousCount: 0,
        windowMs: 60_000,
        maxRequests: 10,
      };
      const result = algorithm.consume(state, 1, 1000);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should shift windows when moving to a new window', () => {
      const state: SlidingWindowCounterState = {
        currentWindowStart: 0,
        currentCount: 5,
        previousWindowStart: -60_000,
        previousCount: 3,
        windowMs: 60_000,
        maxRequests: 10,
      };
      // now=60000 -> new window start = 60000
      // currentWindowStart(0) < 60000, so shift:
      // previousWindowStart=0, previousCount=5, currentCount=0
      const result = algorithm.consume(state, 1, 60_000);

      expect(result.allowed).toBe(true);
      expect(result.state.currentWindowStart).toBe(60_000);
      expect(result.state.previousWindowStart).toBe(0);
      expect(result.state.previousCount).toBe(5);
      expect(result.state.currentCount).toBe(1);
    });

    it('should skip window shift when staying in same window', () => {
      const state: SlidingWindowCounterState = {
        currentWindowStart: 0,
        currentCount: 5,
        previousWindowStart: -60_000,
        previousCount: 3,
        windowMs: 60_000,
        maxRequests: 10,
      };
      // Same window (0), no shift
      const result = algorithm.consume(state, 1, 30_000);

      expect(result.allowed).toBe(true);
      expect(result.state.currentWindowStart).toBe(0);
      expect(result.state.previousCount).toBe(3); // unchanged
      expect(result.state.currentCount).toBe(6);
    });

    it('should handle weight > 1', () => {
      const state: SlidingWindowCounterState = {
        currentWindowStart: 0,
        currentCount: 0,
        previousWindowStart: -60_000,
        previousCount: 0,
        windowMs: 60_000,
        maxRequests: 10,
      };
      const result = algorithm.consume(state, 5, 1000);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(5);
      expect(result.state.currentCount).toBe(5);
    });

    it('should deny based on weighted estimate', () => {
      const state: SlidingWindowCounterState = {
        currentWindowStart: 0,
        currentCount: 8,
        previousWindowStart: -60_000,
        previousCount: 4,
        windowMs: 60_000,
        maxRequests: 10,
      };
      // progress = 30000/60000 = 0.5
      // estimate = 8 + 4 * (1 - 0.5) = 8 + 2 = 10
      // 10 + 1 > 10, denied
      const result = algorithm.consume(state, 1, 30_000);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should return correct resetAt when denied with currentCount > 0', () => {
      const state: SlidingWindowCounterState = {
        currentWindowStart: 0,
        currentCount: 10,
        previousWindowStart: -60_000,
        previousCount: 0,
        windowMs: 60_000,
        maxRequests: 10,
      };
      const result = algorithm.consume(state, 1, 1000);

      expect(result.allowed).toBe(false);
      // currentCount > 0, resetAt = currentWindowStart + windowMs = 0 + 60000 = 60000
      expect(result.resetAt).toBe(60_000);
    });

    it('should deny correctly with only previousCount contributing', () => {
      const state: SlidingWindowCounterState = {
        currentWindowStart: 0,
        currentCount: 0,
        previousWindowStart: -60_000,
        previousCount: 20,
        windowMs: 60_000,
        maxRequests: 10,
      };
      // progress = 1000/60000 ~ 0.0167
      // estimate = 0 + 20 * (1 - 0.0167) = ~19.67
      // 19.67 + 1 > 10, denied
      const result = algorithm.consume(state, 1, 1000);

      expect(result.allowed).toBe(false);
      // currentCount=0, so else branch:
      // timeFraction = 1 - ((10 - 1) / 20) = 1 - 9/20 = 1 - 0.45 = 0.55
      // resetAt = 0 + 0.55 * 60000 = 33000
      expect(result.resetAt).toBe(33_000);
    });

    it('should return correct resetAt when allowed', () => {
      const state: SlidingWindowCounterState = {
        currentWindowStart: 0,
        currentCount: 0,
        previousWindowStart: -60_000,
        previousCount: 0,
        windowMs: 60_000,
        maxRequests: 10,
      };
      const result = algorithm.consume(state, 1, 1000);

      expect(result.allowed).toBe(true);
      // resetAt = currentWindowStart + windowMs = 0 + 60000 = 60000
      expect(result.resetAt).toBe(60_000);
    });

    it('should deny with previousCount=0 when weight exceeds maxRequests (covers || 1 fallback)', () => {
      const state: SlidingWindowCounterState = {
        currentWindowStart: 0,
        currentCount: 0,
        previousWindowStart: -60_000,
        previousCount: 0,
        windowMs: 60_000,
        maxRequests: 10,
      };
      // estimate = 0 + 0 * (1 - 1000/60000) = 0
      // 0 + 15 > 10, denied
      const result = algorithm.consume(state, 15, 1000);

      expect(result.allowed).toBe(false);
      // currentCount=0, so else branch:
      // previousCount=0, so the || 1 kicks in
      // timeFraction = 1 - ((10 - 15) / 1) = 1 - (-5/1) = 1 + 5 = 6
      // resetAt = 0 + 6 * 60000 = 360000
      expect(result.resetAt).toBe(360_000);
    });
  });

  describe('getLimit', () => {
    it('should return maxRequests', () => {
      const limit = algorithm.getLimit(CONFIG as unknown as Record<string, unknown>);
      expect(limit).toBe(10);
    });
  });
});
