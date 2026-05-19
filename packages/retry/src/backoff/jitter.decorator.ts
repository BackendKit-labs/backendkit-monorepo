import type { BackoffStrategy, BackoffConfig, JitterType } from '../retry/types.js';

/**
 * Apply jitter to a delay value.
 * - 'full': random between 0 and delay
 * - 'equal': random between delay/2 and delay
 * - 'decorrelated': random between baseDelay and delay * 3 (stateful)
 */
export function applyJitter(delay: number, type: JitterType): number {
  switch (type) {
    case 'full':
      return Math.random() * delay;
    case 'equal':
      return delay / 2 + Math.random() * (delay / 2);
    case 'decorrelated':
      // Simplified: random between delay and delay * 3
      return delay + Math.random() * (delay * 2);
  }
}

/**
 * Decorator that wraps any BackoffStrategy with jitter.
 */
export class JitterDecorator implements BackoffStrategy {
  constructor(
    private inner: BackoffStrategy,
    private jitterType: JitterType,
  ) {}

  nextDelay(attempt: number): number {
    const delay = this.inner.nextDelay(attempt);
    return applyJitter(delay, this.jitterType);
  }

  reset(): void {
    this.inner.reset();
  }

  clone(overrides?: Partial<BackoffConfig>): JitterDecorator {
    return new JitterDecorator(this.inner.clone(overrides), this.jitterType);
  }
}
