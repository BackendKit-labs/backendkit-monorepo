import { describe, it, expect } from 'vitest';
import { ExponentialBackoff } from '../../src/backoff/exponential.backoff.js';

describe('ExponentialBackoff', () => {
  it('caps the raw (non-jittered) delay at maxDelay', () => {
    const backoff = new ExponentialBackoff({ baseDelay: 1000, maxDelay: 5000 });
    expect(backoff.nextDelay(10)).toBe(5000);
  });

  describe('jitter never exceeds maxDelay', () => {
    for (const jitter of ['full', 'equal', 'decorrelated'] as const) {
      it(`jitter: ${jitter}`, () => {
        const backoff = new ExponentialBackoff({ baseDelay: 1000, maxDelay: 5000, jitter });
        for (let i = 0; i < 500; i++) {
          expect(backoff.nextDelay(10)).toBeLessThanOrEqual(5000);
        }
      });
    }
  });
});
