import type { RetryBudgetConfig } from './types.js';

export interface SlidingWindowBudget {
  tryConsume(): boolean;
  recordSuccess(): void;
  recordFailure(): void;
  recordCall(): void;
  getMetrics(): BudgetMetrics;
}

export interface BudgetMetrics {
  allowed: boolean;
  retryCount: number;
  successCount: number;
  failureCount: number;
  totalCalls: number;
  currentRatio: number;
}

export class SlidingWindowBudgetImpl implements SlidingWindowBudget {
  private calls: number[] = [];
  private retries: number[] = [];
  private successes = 0;
  private failures = 0;

  constructor(private config: RetryBudgetConfig) {}

  private evict(): void {
    const cutoff = Date.now() - this.config.windowMs;
    this.calls = this.calls.filter(t => t > cutoff);
    this.retries = this.retries.filter(t => t > cutoff);
  }

  recordCall(): void {
    this.calls.push(Date.now());
  }

  recordSuccess(): void {
    this.successes++;
  }

  recordFailure(): void {
    this.failures++;
  }

  tryConsume(): boolean {
    this.evict();
    const total = this.calls.length;

    if (total < this.config.minRequestCount) return true;

    const ratio = this.retries.length / total;
    if (ratio >= this.config.maxRetryRatio) return false;

    this.retries.push(Date.now());
    return true;
  }

  getMetrics(): BudgetMetrics {
    this.evict();
    const total = this.calls.length;
    const retries = this.retries.length;
    const ratio = total > 0 ? retries / total : 0;
    return {
      allowed: total < this.config.minRequestCount || ratio < this.config.maxRetryRatio,
      retryCount: retries,
      successCount: this.successes,
      failureCount: this.failures,
      totalCalls: total,
      currentRatio: ratio,
    };
  }
}
