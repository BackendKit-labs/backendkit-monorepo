/**
 * Minimal example — @backendkit-labs/circuit-breaker
 *
 * Run:  npm install && npm start
 *
 * The circuit breaker protects your service from calling a dependency
 * that is known to be failing. Instead of waiting for each call to time out,
 * it fails fast and allows the dependency time to recover.
 *
 * States:
 *   CLOSED    — calls pass through normally
 *   OPEN      — calls are rejected immediately (no network call made)
 *   HALF_OPEN — a few test calls are allowed to check if service recovered
 */

import {
  CircuitBreaker,
  CircuitBreakerState,
  CircuitBreakerOpenError,
} from '@backendkit-labs/circuit-breaker';

// ── Simulated inventory service — can be toggled up/down ─────────────────────

let serviceUp = false;

async function fetchStock(sku: string): Promise<number> {
  await new Promise(r => setTimeout(r, 60));
  if (!serviceUp) throw new Error('Inventory service unavailable');
  return Math.floor(Math.random() * 100) + 1;
}

// ── Circuit breaker setup ─────────────────────────────────────────────────────

const STATE_ICON: Record<CircuitBreakerState, string> = {
  [CircuitBreakerState.CLOSED]:    '🟢 CLOSED',
  [CircuitBreakerState.OPEN]:      '🔴 OPEN',
  [CircuitBreakerState.HALF_OPEN]: '🟡 HALF_OPEN',
};

const cb = new CircuitBreaker({
  name:              'inventory-api',
  failureThreshold:  60,    // open when 60% of recent calls fail
  minimumCalls:      3,     // need at least 3 calls before evaluating
  slidingWindowSize: 5,
  openTimeoutMs:     2_000, // wait 2s before testing recovery (half-open)
  halfOpenMaxCalls:  2,     // 2 successful calls needed to close
  slowCallThreshold: 100,
  slowCallDurationMs: 5_000,
  isFailure: () => true,
  onStateChange: (from, to, metrics) => {
    console.log(`\n  [CB] ${STATE_ICON[from]} → ${STATE_ICON[to]}  (failure rate: ${metrics.failureRate}%)\n`);
  },
});

async function getStock(sku: string): Promise<number | null> {
  return cb.execute(
    () => fetchStock(sku),
    (err) => {
      if (err instanceof CircuitBreakerOpenError) return null; // fast-rejected: serve from cache or null
      return null;                                             // infra failure: safe fallback
    },
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

  // Phase 1: service is DOWN — circuit will open after failures
  console.log('── Phase 1: service DOWN (5 calls) ───────────────────────');
  for (let i = 1; i <= 5; i++) {
    const stock = await getStock('SKU-001');
    console.log(`  call ${i}: stock=${stock ?? 'unavailable'}  state=${STATE_ICON[cb.getState()]}`);
    await delay(100);
  }

  // Phase 2: circuit is OPEN — calls are fast-rejected without touching the service
  console.log('\n── Phase 2: CB OPEN — fast-rejecting calls (3 calls) ────');
  for (let i = 1; i <= 3; i++) {
    const stock = await getStock('SKU-001');
    console.log(`  call ${i}: stock=${stock ?? 'fast-rejected'}  state=${STATE_ICON[cb.getState()]}`);
  }

  // Phase 3: wait for half-open, service comes back up
  console.log('\n── Phase 3: waiting 2s for HALF_OPEN, service recovers ──');
  serviceUp = true;
  await delay(2_200);

  for (let i = 1; i <= 4; i++) {
    const stock = await getStock('SKU-001');
    console.log(`  call ${i}: stock=${stock ?? 'unavailable'}  state=${STATE_ICON[cb.getState()]}`);
    await delay(100);
  }

  console.log('\n── Final metrics ─────────────────────────────────────────');
  const m = cb.getMetrics();
  console.log(`  total calls      : ${m.totalCalls}`);
  console.log(`  successful       : ${m.successfulCalls}`);
  console.log(`  failed           : ${m.failedCalls}`);
  console.log(`  rejected (open)  : ${m.notPermittedCalls}`);
  console.log(`  final state      : ${STATE_ICON[m.state]}`);
}

main().catch(console.error);
