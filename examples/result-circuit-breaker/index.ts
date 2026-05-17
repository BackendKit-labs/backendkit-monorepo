import { ok, fail, run, match } from '@backendkit-labs/result';
import { CircuitBreaker, CircuitBreakerOpenError } from '@backendkit-labs/circuit-breaker';

// ── Setup ────────────────────────────────────────────────────────────────────

class ValidationError extends Error {
  constructor(msg: string) { super(msg); this.name = 'ValidationError'; }
}
class InfraError extends Error {
  constructor(msg: string) { super(msg); this.name = 'InfraError'; }
}

const cb = new CircuitBreaker({
  name:              'user-api',
  failureThreshold:  50,    // open after 50% failures
  minimumCalls:      3,     // need at least 3 calls before evaluating
  slidingWindowSize: 5,
  openTimeoutMs:     2000,
  isFailure: (err) => !(err instanceof ValidationError), // business errors don't count
  onStateChange: (from, to, metrics) => {
    console.log(`\n⚡ Circuit [${metrics.name}]: ${from} → ${to} (failure rate: ${metrics.failureRate}%)`);
  },
});

// ── Simulated API ─────────────────────────────────────────────────────────────

async function fetchUser(id: string) {
  if (id === 'bad-request') throw new ValidationError(`Invalid id: ${id}`);
  if (id === 'server-error') throw new InfraError('Database connection lost');
  return { id, name: 'Alice', email: 'alice@example.com' };
}

async function call(id: string) {
  const result = await run(() => cb.execute(() => fetchUser(id)));
  const label = match(result, {
    ok:   (user) => `✓  ${user.name} (${user.id})`,
    fail: (err)  => {
      if (err instanceof CircuitBreakerOpenError) return `✗  [CIRCUIT OPEN] ${err.message}`;
      if (err instanceof ValidationError)         return `✗  [VALIDATION]   ${err.message}`;
      return                                             `✗  [INFRA]        ${err.message}`;
    },
  });
  console.log(label);
}

// ── Demo ──────────────────────────────────────────────────────────────────────

console.log('── Happy path ─────────────────────────────────────────────');
await call('user-1');
await call('user-2');

console.log('\n── Business error (should NOT trip circuit) ────────────────');
await call('bad-request');
await call('bad-request');
await call('bad-request');
console.log('State after 3 validation errors:', cb.getState()); // still CLOSED

console.log('\n── Infrastructure failures (will trip circuit) ─────────────');
await call('server-error');
await call('server-error');
await call('server-error');
console.log('State after infra failures:', cb.getState()); // OPEN

console.log('\n── Calls while circuit is OPEN ─────────────────────────────');
await call('user-1'); // rejected without hitting the API

console.log('\n── Metrics ──────────────────────────────────────────────────');
console.log(cb.getMetrics());

console.log('\n── Waiting for HALF_OPEN (2s)... ────────────────────────────');
await new Promise((r) => setTimeout(r, 2100));
await call('user-1'); // test call — succeeds → CLOSED
await call('user-2'); // back to normal
await call('user-3');
console.log('Final state:', cb.getState()); // CLOSED
