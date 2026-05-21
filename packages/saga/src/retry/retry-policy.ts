// ---------------------------------------------------------------------------
// @backendkit-labs/saga — src/retry/retry-policy.ts
//
// RetryPolicy interface and default configuration.
// ---------------------------------------------------------------------------

export interface RetryPolicy {
  maxAttempts: number;
  initialBackoffMs: number;
  backoffMultiplier: number;
  maxBackoffMs: number;
  jitter: boolean;
  retryOn: string[];
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  initialBackoffMs: 1000,
  backoffMultiplier: 2,
  maxBackoffMs: 30000,
  jitter: true,
  retryOn: ['INFRASTRUCTURE_ERROR', 'STEP_TIMEOUT'],
};
