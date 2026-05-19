import type { BackoffStrategy, BackoffConfig } from '../again/types.js';

export class LinearBackoff implements BackoffStrategy {
  constructor(
    private config: {
      baseDelay: number;
      multiplier?: number;
      maxDelay?: number;
    },
  ) {
    this.config.multiplier ??= 1;
    this.config.maxDelay ??= Infinity;
  }

  nextDelay(attempt: number): number {
    const delay = this.config.baseDelay * attempt * (this.config.multiplier ?? 1);
    return Math.min(delay, this.config.maxDelay ?? Infinity);
  }

  reset(): void {
    // No state to reset
  }

  clone(overrides?: Partial<BackoffConfig>): LinearBackoff {
    return new LinearBackoff({
      baseDelay: overrides?.baseDelay ?? this.config.baseDelay,
      multiplier: this.config.multiplier,
      maxDelay: this.config.maxDelay,
    });
  }
}
