// ---------------------------------------------------------------------------
// @backendkit-labs/saga — src/retry/backoff-calculator.ts
//
// Exponential backoff calculator with optional jitter.
// Formula: min(initialBackoff * (multiplier ^ (attempt-1)), maxBackoff)
// Jitter: random extra 0-50% of the computed value.
// ---------------------------------------------------------------------------

import type { RetryPolicy } from './retry-policy';

export function calculateBackoffMs(attempt: number, policy: RetryPolicy): number {
  if (attempt <= 1) {
    return 0;
  }

  const exponent = attempt - 1;
  const baseBackoff = policy.initialBackoffMs * Math.pow(policy.backoffMultiplier, exponent);
  const cappedBackoff = Math.min(baseBackoff, policy.maxBackoffMs);

  if (!policy.jitter) {
    return Math.floor(cappedBackoff);
  }

  const jitterFraction = Math.random() * 0.5; // 0 to 0.5 (0-50%)
  const jitteredBackoff = cappedBackoff * (1 + jitterFraction);

  return Math.floor(Math.min(jitteredBackoff, policy.maxBackoffMs));
}
