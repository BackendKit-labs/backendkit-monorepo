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
      // 'decorrelated' can multiply capped by up to 3x -- re-clamp so
      // maxDelay is an actual upper bound, not just a pre-jitter target.
      return Math.min(applyJitter(capped, this.config.jitter), this.config.maxDelay ?? Infinity);
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
