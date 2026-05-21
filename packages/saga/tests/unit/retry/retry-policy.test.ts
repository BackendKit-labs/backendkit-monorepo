import { DEFAULT_RETRY_POLICY } from '../../../src/retry/retry-policy';
import type { RetryPolicy } from '../../../src/retry/retry-policy';

describe('retry-policy', () => {
  describe('DEFAULT_RETRY_POLICY', () => {
    it('should have maxAttempts of 3', () => {
      expect(DEFAULT_RETRY_POLICY.maxAttempts).toBe(3);
    });

    it('should have initialBackoffMs of 1000', () => {
      expect(DEFAULT_RETRY_POLICY.initialBackoffMs).toBe(1000);
    });

    it('should have backoffMultiplier of 2', () => {
      expect(DEFAULT_RETRY_POLICY.backoffMultiplier).toBe(2);
    });

    it('should have maxBackoffMs of 30000', () => {
      expect(DEFAULT_RETRY_POLICY.maxBackoffMs).toBe(30000);
    });

    it('should have jitter enabled', () => {
      expect(DEFAULT_RETRY_POLICY.jitter).toBe(true);
    });

    it('should retry on INFRASTRUCTURE_ERROR and STEP_TIMEOUT', () => {
      expect(DEFAULT_RETRY_POLICY.retryOn).toEqual(['INFRASTRUCTURE_ERROR', 'STEP_TIMEOUT']);
    });
  });

  describe('RetryPolicy interface', () => {
    it('should accept a valid RetryPolicy object', () => {
      const policy: RetryPolicy = {
        maxAttempts: 5,
        initialBackoffMs: 500,
        backoffMultiplier: 1.5,
        maxBackoffMs: 10000,
        jitter: false,
        retryOn: ['INFRASTRUCTURE_ERROR'],
      };

      expect(policy.maxAttempts).toBe(5);
      expect(policy.retryOn).toHaveLength(1);
    });

    it('should accept empty retryOn array', () => {
      const policy: RetryPolicy = {
        maxAttempts: 1,
        initialBackoffMs: 100,
        backoffMultiplier: 1,
        maxBackoffMs: 1000,
        jitter: false,
        retryOn: [],
      };

      expect(policy.retryOn).toEqual([]);
    });
  });
});
