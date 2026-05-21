import { FixedWindowAlgorithm, FixedWindowState } from '../../../src/algorithms';

describe('FixedWindowAlgorithm', () => {
  const CONFIG = { windowMs: 60_000, maxRequests: 10 };
  let algorithm: FixedWindowAlgorithm;

  beforeEach(() => {
    algorithm = new FixedWindowAlgorithm();
  });

  describe('name', () => {
    it('should return the algorithm name', () => {
      expect(algorithm.name).toBe('fixed-window');
    });
  });

  describe('initialState', () => {
    it('should create initial state with zero count', () => {
      const state = algorithm.initialState(CONFIG as unknown as Record<string, unknown>);
      expect(state.count).toBe(0);
      expect(state.windowStart).toBe(0);
      expect(state.windowMs).toBe(60_000);
      expect(state.maxRequests).toBe(10);
    });
  });

  describe('consume', () => {
    it('should allow first request in a window', () => {
      const state = algorithm.initialState(CONFIG as unknown as Record<string, unknown>);
      const result = algorithm.consume(state, 1, 1000);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
      expect(result.state.count).toBe(1);
      // windowStart = floor(1000/60000)*60000 = 0
      expect(result.state.windowStart).toBe(0);
    });

    it('should allow requests up to maxRequests', () => {
      const state: FixedWindowState = {
        count: 9,
        windowStart: 0,
        windowMs: 60_000,
        maxRequests: 10,
      };
      const result = algorithm.consume(state, 1, 5000);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(0);
      expect(result.state.count).toBe(10);
    });

    it('should deny when count exceeds maxRequests', () => {
      const state: FixedWindowState = {
        count: 10,
        windowStart: 0,
        windowMs: 60_000,
        maxRequests: 10,
      };
      const result = algorithm.consume(state, 1, 5000);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should reset count on new window', () => {
      const state: FixedWindowState = {
        count: 10,
        windowStart: 0,
        windowMs: 60_000,
        maxRequests: 10,
      };
      // now=60000 -> new window start = 60000
      const result = algorithm.consume(state, 1, 60_000);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
      expect(result.state.count).toBe(1);
      expect(result.state.windowStart).toBe(60_000);
    });

    it('should handle weight > 1', () => {
      const state = algorithm.initialState(CONFIG as unknown as Record<string, unknown>);
      const result = algorithm.consume(state, 5, 0);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(5);
      expect(result.state.count).toBe(5);
    });

    it('should deny when weight exceeds maxRequests immediately', () => {
      const state = algorithm.initialState(CONFIG as unknown as Record<string, unknown>);
      // weight=15 > max=10
      const result = algorithm.consume(state, 15, 0);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should deny when cumulative count exceeds maxRequests with weight', () => {
      const state: FixedWindowState = {
        count: 8,
        windowStart: 0,
        windowMs: 60_000,
        maxRequests: 10,
      };
      // 8 + 5 = 13 > 10
      const result = algorithm.consume(state, 5, 5000);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      // count is updated (algorithm tracks actual total even when denied)
      expect(result.state.count).toBe(13);
    });

    it('should return correct resetAt', () => {
      const state: FixedWindowState = {
        count: 9,
        windowStart: 0,
        windowMs: 60_000,
        maxRequests: 10,
      };
      const result = algorithm.consume(state, 1, 5000);

      expect(result.allowed).toBe(true);
      expect(result.resetAt).toBe(60_000);
    });

    it('should allow partial consumption after window reset with weight', () => {
      const state: FixedWindowState = {
        count: 9,
        windowStart: 0,
        windowMs: 60_000,
        maxRequests: 10,
      };
      // New window at 60000
      const result = algorithm.consume(state, 3, 60_000);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(7);
      expect(result.state.count).toBe(3);
      expect(result.state.windowStart).toBe(60_000);
    });

    it('should handle weight=0 (check only, no mutation)', () => {
      const state: FixedWindowState = {
        count: 5,
        windowStart: 0,
        windowMs: 60_000,
        maxRequests: 10,
      };
      const result = algorithm.consume(state, 0, 5000);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(5);
      expect(result.state.count).toBe(5); // count unchanged
      expect(result.state.windowStart).toBe(0); // window unchanged
    });

    it('should handle weight=0 in a new window after reset', () => {
      const state: FixedWindowState = {
        count: 10,
        windowStart: 0,
        windowMs: 60_000,
        maxRequests: 10,
      };
      // New window at 60000
      const result = algorithm.consume(state, 0, 60_000);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(10);
      expect(result.state.count).toBe(0); // reset to 0 (weight=0)
      expect(result.state.windowStart).toBe(60_000);
    });
  });

  describe('getLimit', () => {
    it('should return maxRequests', () => {
      const limit = algorithm.getLimit(CONFIG as unknown as Record<string, unknown>);
      expect(limit).toBe(10);
    });
  });
});
