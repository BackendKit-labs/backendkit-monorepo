import type { BackoffStrategy, BackoffConfig, JitterType } from '../retry/types.js';
import { applyJitter } from './jitter.decorator.js';

export class ExponentialBackoff implements BackoffStrategy {
  constructor(
    private config: {
      baseDelay: number;
      multiplier?: number;
      maxDelay?: number;
      jitter?: JitterType;
    },
  ) {
    this.config.multiplier ??= 2;
    this.config.maxDelay ??= Infinity;
  }

  nextDelay(attempt: number): number {
    const delay = this.config.baseDelay * Math.pow(this.config.multiplier ?? 2, attempt - 1);
    const capped = Math.min(delay, this.config.maxDelay ?? Infinity);
    if (this.config.jitter) {
      return applyJitter(capped, this.config.jitter);
    }
    return capped;
  }

  reset(): void {
    // No state to reset
  }

  clone(overrides?: Partial<BackoffConfig>): ExponentialBackoff {
    return new ExponentialBackoff({
      baseDelay: overrides?.baseDelay ?? this.config.baseDelay,
      multiplier: this.config.multiplier,
      maxDelay: this.config.maxDelay,
      jitter: this.config.jitter,
    });
  }
}
