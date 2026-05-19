/**
 * Minimal example — @backendkit-labs/again
 *
 * Run:  npm install && npm start
 *
 * The problem with manual retry:
 *   - Boilerplate loop with mutable state
 *   - No built-in backoff, jitter, or budget
 *   - Error classification and hooks require even more code
 *
 * again() handles all of that:
 *   - Returns Result<T, AgainError> — never throws
 *   - Exponential backoff + jitter out of the box
 *   - Lifecycle hooks for logging and observability
 */

import { again } from '@backendkit-labs/again';

// ── Simulated payment gateway — fails 60% of the time ────────────────────────

async function chargeGateway(amount: number): Promise<{ transactionId: string }> {
  await new Promise(r => setTimeout(r, 80 + Math.random() * 120));

  if (Math.random() < 0.6) {
    throw Object.assign(new Error('Gateway timeout'), { status: 503 });
  }

  return { transactionId: `txn-${Date.now()}` };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Charging $49.99 — payment gateway fails 60% of the time\n');

  const result = await again(
    () => chargeGateway(4999),
    {
      maxAttempts: 4,
      backoff: { type: 'exponential', baseDelay: 300, maxDelay: 3_000, jitter: 'full' },
      hooks: {
        beforeRetry: ({ attempt, delayMs, error }) =>
          console.log(`  ↩  attempt ${attempt} failed (${error.message}) — retrying in ${Math.round(delayMs)}ms`),
        onRetrySuccess: ({ attempt }) =>
          console.log(`  ✓  succeeded on attempt ${attempt}`),
        onExhausted: ({ totalAttempts, lastError }) =>
          console.log(`  ✗  all ${totalAttempts} attempts failed — last error: ${lastError?.message}`),
      },
    },
  );

  console.log();

  if (result.ok) {
    console.log(`Payment charged — transaction: ${result.value.transactionId}`);
  } else {
    const { type, message, metadata } = result.error;
    console.log(`Payment failed after ${metadata.attempts} attempt(s)`);
    console.log(`  error type : ${type}`);
    console.log(`  message    : ${message}`);
    console.log(`  elapsed    : ${metadata.totalElapsedMs}ms`);
  }
}

main().catch(console.error);
