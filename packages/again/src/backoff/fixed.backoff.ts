import type { BackoffStrategy, BackoffConfig } from '../again/types.js';

export class FixedBackoff implements BackoffStrategy {
  constructor(private config: { baseDelay: number }) {}

  nextDelay(_attempt: number): number {
    return this.config.baseDelay;
  }

  reset(): void {
    // No state to reset
  }

  clone(overrides?: Partial<BackoffConfig>): FixedBackoff {
    return new FixedBackoff({
      baseDelay: overrides?.baseDelay ?? this.config.baseDelay,
    });
  }
}
