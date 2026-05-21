import { resolveAlgorithm, getAvailableAlgorithms } from '../../../src/algorithms/algorithm-registry';
import { TokenBucketAlgorithm } from '../../../src/algorithms/token-bucket.algorithm';
import { FixedWindowAlgorithm } from '../../../src/algorithms/fixed-window.algorithm';
import { SlidingWindowLogAlgorithm } from '../../../src/algorithms/sliding-window-log.algorithm';
import { SlidingWindowCounterAlgorithm } from '../../../src/algorithms/sliding-window-counter.algorithm';

describe('algorithm-registry', () => {
  describe('resolveAlgorithm', () => {
    it('should return TokenBucketAlgorithm for "token-bucket"', () => {
      const algo = resolveAlgorithm('token-bucket');
      expect(algo).toBeInstanceOf(TokenBucketAlgorithm);
    });

    it('should return FixedWindowAlgorithm for "fixed-window"', () => {
      const algo = resolveAlgorithm('fixed-window');
      expect(algo).toBeInstanceOf(FixedWindowAlgorithm);
    });

    it('should return SlidingWindowLogAlgorithm for "sliding-window-log"', () => {
      const algo = resolveAlgorithm('sliding-window-log');
      expect(algo).toBeInstanceOf(SlidingWindowLogAlgorithm);
    });

    it('should return SlidingWindowCounterAlgorithm for "sliding-window-counter"', () => {
      const algo = resolveAlgorithm('sliding-window-counter');
      expect(algo).toBeInstanceOf(SlidingWindowCounterAlgorithm);
    });

    it('should throw for unknown algorithm', () => {
      expect(() => resolveAlgorithm('unknown')).toThrow(/Unknown algorithm/);
    });
  });

  describe('getAvailableAlgorithms', () => {
    it('should list all algorithm names', () => {
      const list = getAvailableAlgorithms();
      expect(list).toContain('token-bucket');
      expect(list).toContain('fixed-window');
      expect(list).toContain('sliding-window-log');
      expect(list).toContain('sliding-window-counter');
      expect(list.length).toBe(4);
    });
  });
});
