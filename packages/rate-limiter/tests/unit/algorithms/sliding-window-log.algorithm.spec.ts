import { SlidingWindowLogAlgorithm, SlidingWindowLogState } from '../../../src/algorithms';

describe('SlidingWindowLogAlgorithm', () => {
  const CONFIG = { windowMs: 60_000, maxRequests: 5 };
  let algorithm: SlidingWindowLogAlgorithm;

  beforeEach(() => {
    algorithm = new SlidingWindowLogAlgorithm();
  });

  describe('name', () => {
    it('should return the algorithm name', () => {
      expect(algorithm.name).toBe('sliding-window-log');
    });
  });

  describe('initialState', () => {
    it('should create state with empty timestamps', () => {
      const state = algorithm.initialState(CONFIG as unknown as Record<string, unknown>);
      expect(state.timestamps).toEqual([]);
      expect(state.windowMs).toBe(60_000);
      expect(state.maxRequests).toBe(5);
    });
  });

  describe('consume', () => {
    it('should allow first request', () => {
      const state = algorithm.initialState(CONFIG as unknown as Record<string, unknown>);
      const result = algorithm.consume(state, 1, 1000);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
      expect(result.state.timestamps).toEqual([1000]);
    });

    it('should allow requests up to maxRequests', () => {
      const state = algorithm.initialState(CONFIG as unknown as Record<string, unknown>);

      let s: SlidingWindowLogState = { ...state };
      for (let i = 0; i < 4; i++) {
        const r = algorithm.consume(s, 1, 1000 + i * 100);
        s = r.state;
      }
      const result = algorithm.consume(s, 1, 1400);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(0);
    });

    it('should deny when at maxRequests', () => {
      const state: SlidingWindowLogState = {
        timestamps: [1000, 1100, 1200, 1300, 1400],
        windowMs: 60_000,
        maxRequests: 5,
      };
      const result = algorithm.consume(state, 1, 1500);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should filter expired timestamps', () => {
      const state: SlidingWindowLogState = {
        timestamps: [1000, 2000, 3000],
        windowMs: 2000,
        maxRequests: 5,
      };
      const result = algorithm.consume(state, 1, 4000);

      expect(result.allowed).toBe(true);
      expect(result.state.timestamps).toEqual([3000, 4000]);
    });

    it('should handle weight > 1', () => {
      const state: SlidingWindowLogState = {
        timestamps: [1000],
        windowMs: 60_000,
        maxRequests: 5,
      };
      const result = algorithm.consume(state, 3, 2000);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(1);
      expect(result.state.timestamps).toEqual([1000, 2000, 2000, 2000]);
    });

    it('should deny when weight exceeds capacity', () => {
      const state: SlidingWindowLogState = {
        timestamps: [1000, 1100, 1200, 1300],
        windowMs: 60_000,
        maxRequests: 5,
      };
      const result = algorithm.consume(state, 2, 1400);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should return correct resetAt when denied with full history', () => {
      const state: SlidingWindowLogState = {
        timestamps: [1000, 1100, 1200, 1300, 1400],
        windowMs: 60_000,
        maxRequests: 5,
      };
      const result = algorithm.consume(state, 1, 1500);

      expect(result.allowed).toBe(false);
      expect(result.resetAt).toBe(61_000);
    });

    it('should return correct resetAt when denied at edge', () => {
      const state: SlidingWindowLogState = {
        timestamps: [1000, 1100, 1200],
        windowMs: 60_000,
        maxRequests: 5,
      };
      const result = algorithm.consume(state, 3, 1500);

      expect(result.allowed).toBe(false);
      expect(result.resetAt).toBe(61_000);
    });

    it('should return resetAt based on now when not enough history', () => {
      const state: SlidingWindowLogState = {
        timestamps: [1000],
        windowMs: 60_000,
        maxRequests: 5,
      };
      const result = algorithm.consume(state, 5, 1500);
      expect(result.allowed).toBe(false);
      expect(result.resetAt).toBe(61_000);
    });

    it('should return correct resetAt when allowed', () => {
      const state: SlidingWindowLogState = {
        timestamps: [1000],
        windowMs: 60_000,
        maxRequests: 5,
      };
      const result = algorithm.consume(state, 1, 2000);

      expect(result.allowed).toBe(true);
      expect(result.resetAt).toBe(61_000);
    });

    it('should handle weight=0 (check only, no timestamp added)', () => {
      const state: SlidingWindowLogState = {
        timestamps: [1000],
        windowMs: 60_000,
        maxRequests: 5,
      };
      const result = algorithm.consume(state, 0, 2000);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
      expect(result.state.timestamps).toEqual([1000]);
      expect(result.resetAt).toBe(61_000);
    });

    it('should use now+windowMs for resetAt when all timestamps expired (empty newTimestamps)', () => {
      const state: SlidingWindowLogState = {
        timestamps: [1000],
        windowMs: 500,
        maxRequests: 5,
      };
      // now=2000, windowStart=1500, timestamps > 1500 -> [], so newTimestamps is empty
      const result = algorithm.consume(state, 0, 2000);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(5);
      expect(result.state.timestamps).toEqual([]);
      expect(result.resetAt).toBe(2500);
    });

    it('should not mutate the original state', () => {
      const state: SlidingWindowLogState = {
        timestamps: [1000, 2000],
        windowMs: 60_000,
        maxRequests: 5,
      };
      algorithm.consume(state, 1, 3000);
      expect(state.timestamps).toEqual([1000, 2000]);
    });
  });

  describe('getLimit', () => {
    it('should return maxRequests', () => {
      const limit = algorithm.getLimit(CONFIG as unknown as Record<string, unknown>);
      expect(limit).toBe(5);
    });
  });
});
