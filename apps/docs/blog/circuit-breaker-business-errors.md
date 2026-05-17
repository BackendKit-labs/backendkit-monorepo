---
title: "Circuit breaker patterns in Node.js — and why business errors shouldn't trip yours"
description: Most circuit breakers treat all errors equally. That's wrong. Here's why the distinction between business and infrastructure errors matters.
---

# Circuit breaker patterns in Node.js — and why business errors shouldn't trip yours

A circuit breaker is a straightforward idea: if a dependency fails too often, stop calling it for a while. Let it recover. Then try again.

The problem is the definition of "fails." Most implementations answer: **any exception**. That's wrong, and it leads to phantom opens — circuits that trip on errors that have nothing to do with the health of the dependency.

---

## What a circuit breaker does

Three states. Three rules.

**CLOSED** — normal operation. Calls go through. The breaker tracks a sliding window of results.

**OPEN** — calls are rejected immediately without hitting the downstream. Triggered when the failure rate in the window exceeds a threshold.

**HALF_OPEN** — after a timeout, a small number of test calls are allowed through. If they succeed, the circuit closes. If they fail, it opens again.

```
CLOSED → (failure rate ≥ threshold) → OPEN
OPEN   → (timeout elapsed)          → HALF_OPEN
HALF_OPEN → (test calls succeed)    → CLOSED
HALF_OPEN → (test call fails)       → OPEN
```

The goal is **fail-fast with automatic recovery**. Your service stays responsive even when a dependency degrades.

---

## The classification problem

Here's where most implementations go wrong. Consider a service that calls a user API:

```typescript
// Scenario A: the database is down
// → 503 Service Unavailable

// Scenario B: the user doesn't exist
// → 404 Not Found

// Scenario C: the request is malformed
// → 400 Bad Request
```

All three throw an error. A naive circuit breaker counts all three as failures. But Scenario B and C are **expected outcomes** — they tell you something about the request, not about the health of the dependency. Counting them as failures will trip the circuit during normal traffic, breaking your service when the dependency is perfectly fine.

The fix: classify errors before counting them.

---

## isFailure() — the classification hook

`@backendkit-labs/circuit-breaker` exposes `isFailure` as a required config option. It puts the classification decision in your hands:

```typescript
import { CircuitBreaker } from '@backendkit-labs/circuit-breaker';

const cb = new CircuitBreaker({
  name:             'user-api',
  failureThreshold: 50,
  minimumCalls:     5,
  slidingWindowSize: 10,
  openTimeoutMs:    10_000,

  isFailure: (error) => {
    // HTTP 4xx = business error — the request was wrong, not the service
    if (error instanceof HttpError && error.status < 500) return false;
    // Everything else = infrastructure failure
    return true;
  },
});
```

When `isFailure` returns `false`, the call is treated as a **success** for circuit breaker purposes. The error still propagates to the caller — it's just transparent to the circuit.

---

## Real classification examples

**Payment APIs (Stripe, PayPal)**

```typescript
isFailure: (err) => {
  if (err instanceof StripeCardError)      return false; // card declined — business error
  if (err instanceof StripeInvalidRequest) return false; // bad params — business error
  return true; // network error, 5xx, timeout — infrastructure
}
```

**Database calls**

```typescript
isFailure: (err) => {
  if (err instanceof EntityNotFoundError)       return false; // expected
  if (err instanceof UniqueConstraintViolation) return false; // expected
  return true; // connection lost, query timeout — infrastructure
}
```

**Internal services behind HTTP**

```typescript
isFailure: (err) => !(err instanceof HttpException) || err.getStatus() >= 500;
```

The pattern: **business errors are expected outcomes of valid requests. Infrastructure errors indicate the dependency is degraded.**

---

## Slow calls are failures too

A dependency that responds in 30 seconds is not healthy — even if the response is successful. The `slowCallThreshold` and `slowCallDurationMs` config options handle this:

```typescript
const cb = new CircuitBreaker({
  name:               'slow-api',
  failureThreshold:   50,
  slowCallThreshold:  80,   // open if 80% of calls are slow
  slowCallDurationMs: 2000, // anything over 2s is "slow"
  minimumCalls:       5,
  slidingWindowSize:  10,
  openTimeoutMs:      15_000,
  isFailure:          (err) => true,
});
```

Slow calls count toward the failure rate separately. You can set both thresholds — the circuit opens when either is exceeded.

---

## Observing state changes

Production circuit breakers should emit signals when they transition:

```typescript
const cb = new CircuitBreaker({
  name: 'payment-api',
  // ...
  onStateChange: (from, to, metrics) => {
    logger.warn('circuit-breaker state change', {
      name:        metrics.name,
      from,
      to,
      failureRate: metrics.failureRate,
      slowRate:    metrics.slowCallRate,
      totalCalls:  metrics.totalCalls,
    });

    if (to === 'open') {
      alerting.trigger(`Circuit ${metrics.name} opened`);
    }
  },
});
```

`metrics` is a snapshot at the moment of transition — failure rate, slow call rate, total calls, buffered calls. Everything you need to understand why the circuit opened.

---

## The full picture

A well-configured circuit breaker:

1. **Classifies errors explicitly** — business errors don't contribute to the failure rate
2. **Detects slow calls** — not just errors
3. **Emits signals on transitions** — so your alerting knows when things degrade
4. **Recovers automatically** — the HALF_OPEN probe closes the circuit when the dependency recovers

The circuit breaker is not a retry mechanism — retries happen inside it, or at the caller level. Its job is isolation: when a dependency is degraded, your service keeps running.

---

## Next steps

- [`@backendkit-labs/circuit-breaker` — full API reference](/packages/circuit-breaker): `CircuitBreakerRegistry`, presets, slow call config, `canAttempt()`
- [Getting Started guide](/guide/getting-started): how `circuit-breaker` composes with `result`
- [Auto-Learning](/packages/auto-learning): automatically tune `failureThreshold`, `openTimeoutMs`, and `slowCallDurationMs` from real traffic data
