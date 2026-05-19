import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SlidingWindowBudgetImpl } from '../../src/Retry/Retry.budget.js';
import type { RetryBudgetConfig } from '../../src/Retry/types.js';

const defaultConfig: RetryBudgetConfig = {
  windowMs: 10_000,
  maxRetryRatio: 0.2,
  minRequestCount: 5,
};

function makeBudget(overrides?: Partial<RetryBudgetConfig>): SlidingWindowBudgetImpl {
  return new SlidingWindowBudgetImpl({ ...defaultConfig, ...overrides });
}

describe('SlidingWindowBudgetImpl', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('allows retries when below minRequestCount', () => {
    const budget = makeBudget({ minRequestCount: 10 });
    // Only 3 calls — below minimum
    budget.recordCall();
    budget.recordCall();
    budget.recordCall();
    expect(budget.tryConsume()).toBe(true);
  });

  it('allows retries when retry ratio is within limit', () => {
    const budget = makeBudget({ maxRetryRatio: 0.5, minRequestCount: 4 });
    // 4 calls, try to consume 1 retry (1/4 = 0.25 < 0.5)
    budget.recordCall();
    budget.recordCall();
    budget.recordCall();
    budget.recordCall();
    expect(budget.tryConsume()).toBe(true);
  });

  it('blocks retries when retry ratio reaches limit', () => {
    const budget = makeBudget({ maxRetryRatio: 0.2, minRequestCount: 5 });
    // 5 calls — at minRequestCount
    for (let i = 0; i < 5; i++) budget.recordCall();
    // 1 retry consumed = 1/5 = 0.2 → exactly at limit, next should be blocked
    budget.tryConsume(); // consumes 1 retry (ratio becomes 1/5 = 0.2 at next check)
    // Now ratio is 1/5 = 0.2 which equals maxRetryRatio → blocked
    expect(budget.tryConsume()).toBe(false);
  });

  it('counts consumed retries correctly', () => {
    const budget = makeBudget({ maxRetryRatio: 0.5, minRequestCount: 4 });
    for (let i = 0; i < 10; i++) budget.recordCall();
    // Allow up to 50% retries: 5 out of 10
    let allowed = 0;
    for (let i = 0; i < 10; i++) {
      if (budget.tryConsume()) allowed++;
    }
    expect(allowed).toBe(5);
  });

  it('resets counts after window expires', () => {
    vi.useFakeTimers();
    const budget = makeBudget({ windowMs: 1_000, maxRetryRatio: 0.2, minRequestCount: 5 });
    for (let i = 0; i < 10; i++) budget.recordCall();
    // Fill up retries
    for (let i = 0; i < 3; i++) budget.tryConsume();

    // Advance time past window
    vi.advanceTimersByTime(1_100);

    // New calls in fresh window — below minRequestCount Retry
    budget.recordCall();
    expect(budget.tryConsume()).toBe(true);
    vi.useRealTimers();
  });

  it('recordSuccess and recordFailure update counters', () => {
    const budget = makeBudget();
    budget.recordSuccess();
    budget.recordSuccess();
    budget.recordFailure();
    const metrics = budget.getMetrics();
    expect(metrics.successCount).toBe(2);
    expect(metrics.failureCount).toBe(1);
  });

  it('getMetrics returns allowed=true when below minRequestCount', () => {
    const budget = makeBudget({ minRequestCount: 10 });
    budget.recordCall();
    const metrics = budget.getMetrics();
    expect(metrics.allowed).toBe(true);
    expect(metrics.totalCalls).toBe(1);
  });

  it('getMetrics returns correct currentRatio', () => {
    const budget = makeBudget({ maxRetryRatio: 0.5, minRequestCount: 4 });
    for (let i = 0; i < 10; i++) budget.recordCall();
    budget.tryConsume();
    budget.tryConsume();
    const metrics = budget.getMetrics();
    expect(metrics.retryCount).toBe(2);
    expect(metrics.currentRatio).toBeCloseTo(0.2);
  });
});
