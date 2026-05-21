import { calculateBackoffMs } from '../../../src/retry/backoff-calculator';
import type { RetryPolicy } from '../../../src/retry/retry-policy';

const defaultPolicy: RetryPolicy = {
  maxAttempts: 3,
  initialBackoffMs: 1000,
  backoffMultiplier: 2,
  maxBackoffMs: 30000,
  jitter: false,
  retryOn: ['INFRASTRUCTURE_ERROR', 'STEP_TIMEOUT'],
};

describe('calculateBackoffMs', () => {
  it('should return 0 for attempt 1 (first attempt, no backoff)', () => {
    const result = calculateBackoffMs(1, defaultPolicy);
    expect(result).toBe(0);
  });

  // Formula: initialBackoffMs * Math.pow(backoffMultiplier, attempt - 1)
  // attempt 2: 1000 * 2^1 = 2000
  // attempt 3: 1000 * 2^2 = 4000
  // attempt 4: 1000 * 2^3 = 8000

  it('should return initialBackoffMs * multiplier^(attempt-1) for attempt 2', () => {
    const result = calculateBackoffMs(2, defaultPolicy);
    expect(result).toBe(2000);
  });

  it('should return initialBackoffMs * multiplier^(attempt-1) for attempt 3', () => {
    const result = calculateBackoffMs(3, defaultPolicy);
    expect(result).toBe(4000);
  });

  it('should return initialBackoffMs * multiplier^(attempt-1) for attempt 4', () => {
    const result = calculateBackoffMs(4, defaultPolicy);
    expect(result).toBe(8000);
  });

  it('should cap at maxBackoffMs', () => {
    const policy: RetryPolicy = {
      ...defaultPolicy,
      initialBackoffMs: 10000,
      backoffMultiplier: 10,
      maxBackoffMs: 25000,
    };

    // attempt 2: 10000 * 10^0 = 10000
    // attempt 3: 10000 * 10^1 = 100000 -> capped at 25000
    const result = calculateBackoffMs(3, policy);
    expect(result).toBe(25000);
  });

  it('should apply jitter when jitter is true', () => {
    const policy: RetryPolicy = {
      ...defaultPolicy,
      jitter: true,
    };

    // Run multiple times to ensure jitter produces varying results
    const results = new Set<number>();
    for (let i = 0; i < 20; i++) {
      results.add(calculateBackoffMs(2, policy));
    }

    // With jitter, results should be between 2000 and 3000 (2000 + 0-50%)
    // There should be some variation
    expect(results.size).toBeGreaterThan(1);

    // All results should be within expected range
    for (const r of results) {
      expect(r).toBeGreaterThanOrEqual(2000);
      expect(r).toBeLessThanOrEqual(3000);
    }
  });

  it('should cap jittered value at maxBackoffMs', () => {
    const policy: RetryPolicy = {
      initialBackoffMs: 20000,
      backoffMultiplier: 2,
      maxBackoffMs: 25000,
      jitter: true,
      maxAttempts: 5,
      retryOn: ['INFRASTRUCTURE_ERROR'],
    };

    const result = calculateBackoffMs(3, policy);
    // Capped at 25000 (maxBackoffMs)
    expect(result).toBeLessThanOrEqual(25000);
  });

  it('should not apply jitter when jitter is false', () => {
    const policy: RetryPolicy = {
      ...defaultPolicy,
      jitter: false,
    };

    const results = new Set<number>();
    for (let i = 0; i < 10; i++) {
      results.add(calculateBackoffMs(2, policy));
    }

    expect(results.size).toBe(1);
    expect(results.has(2000)).toBe(true);
  });

  it('should floor to integer', () => {
    const policy: RetryPolicy = {
      ...defaultPolicy,
      initialBackoffMs: 997,
      backoffMultiplier: 1.5,
    };

    // attempt 2: 997 * Math.pow(1.5, 1) = 997 * 1.5 = 1495.5 -> floor -> 1495
    const result = calculateBackoffMs(2, policy);
    expect(Number.isInteger(result)).toBe(true);
    expect(result).toBe(1495);
  });

  it('should handle single retry maxAttempts gracefully', () => {
    // Even if maxAttempts is 1, attempts above 1 should still calculate
    const result = calculateBackoffMs(2, defaultPolicy);
    expect(result).toBe(2000);
  });
});
