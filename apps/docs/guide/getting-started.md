---
title: Getting Started
description: From zero to a resilient Node.js service in 5 minutes — Result, Circuit Breaker, and the composition story.
---

# Getting Started

BackendKit Labs is a suite of composable building blocks for resilient Node.js backends. Each package solves one problem; together they share a common error model so they wire up without glue code.

This guide takes you from `npm install` to a working, resilient service — with explicit errors, a circuit breaker, and no `try/catch`.

---

## What you'll build

A function that calls an external API, returns typed results, and automatically stops hammering the API when it's down — without a single `try/catch`.

**Time:** ~5 minutes  
**Requirements:** Node.js 18+, TypeScript

---

## Step 1 — Install

```bash
npm install @backendkit-labs/result @backendkit-labs/circuit-breaker
```

---

## Step 2 — Explicit errors with Result

`Result<T, E>` is the foundation. Instead of throwing, functions return a value that's either `ok` or `fail` — and the compiler forces you to handle both.

```typescript
import { ok, fail, run, match } from '@backendkit-labs/result';

// Constructors
const success = ok(42);          // { ok: true,  value: 42 }
const failure = fail('oops');    // { ok: false, error: 'oops' }

// Wrap any throwable async call
const result = await run(() => fetch('https://api.example.com/users/1'));

// Handle both branches — exhaustively
const message = match(result, {
  ok:   (res)   => `Got response: ${res.status}`,
  fail: (error) => `Failed: ${error.message}`,
});
```

No uncaught exceptions. The type system tells you whether `.value` or `.error` is available.

---

## Step 3 — Add a Circuit Breaker

A circuit breaker watches your calls and opens when too many fail — stopping further calls so a degraded dependency doesn't cascade into your service.

```typescript
import { CircuitBreaker } from '@backendkit-labs/circuit-breaker';

const cb = new CircuitBreaker({
  name:              'user-api',
  failureThreshold:  50,   // open after 50% failures in the window
  minimumCalls:      5,    // need at least 5 calls before evaluating
  slidingWindowSize: 10,   // track the last 10 calls
  openTimeoutMs:     5000, // wait 5s before probing again
  isFailure: (err) => !(err instanceof ValidationError), // business errors don't count
});
```

`isFailure` is the key insight: it lets you classify which errors are infrastructure failures (that should trip the circuit) versus business errors (like 404 Not Found, which are expected and should be transparent).

---

## Step 4 — Compose them together

Here's where both packages click. `cb.execute()` already returns a `Promise<T>` — wrap it in `run()` and you get `Result<T, E>` with circuit breaker protection and no `try/catch`:

```typescript
import { run, match } from '@backendkit-labs/result';
import { CircuitBreaker, CircuitBreakerOpenError } from '@backendkit-labs/circuit-breaker';

class ValidationError extends Error {}

const cb = new CircuitBreaker({
  name:             'user-api',
  failureThreshold: 50,
  minimumCalls:     5,
  slidingWindowSize: 10,
  openTimeoutMs:    5000,
  isFailure: (err) => !(err instanceof ValidationError),
});

async function getUser(id: string) {
  return run(() =>
    cb.execute(() => fetch(`https://api.example.com/users/${id}`).then(r => r.json()))
  );
}

// Usage — no try/catch anywhere
const result = await getUser('123');

match(result, {
  ok:   (user) => console.log('User:', user.name),
  fail: (err)  => {
    if (err instanceof CircuitBreakerOpenError) {
      console.log('Circuit open — serving from cache');
    } else {
      console.log('API error:', err.message);
    }
  },
});
```

The circuit breaker and the Result type speak the same language: errors are values, classified explicitly, handled exhaustively.

---

## Step 5 — Handle failure modes

Use the `fallback` parameter on `cb.execute()` for inline recovery:

```typescript
const result = await run(() =>
  cb.execute(
    () => fetchUser(id),
    (err) => err instanceof CircuitBreakerOpenError
      ? getCachedUser(id)   // circuit open → serve cache
      : getDefaultUser(),   // infra failure → safe default
  )
);
```

Or observe state changes to alert when the circuit opens:

```typescript
const cb = new CircuitBreaker({
  name: 'user-api',
  // ...
  onStateChange: (from, to, metrics) => {
    if (to === 'open') {
      logger.warn(`Circuit ${metrics.name} opened — failure rate: ${metrics.failureRate}%`);
    }
  },
});
```

---

## What you have now

With ~20 lines of application code you have:

- **Explicit errors** — no silent exceptions, every failure path is in the type signature
- **Circuit breaker** — the API gets isolated when it degrades; your service stays up
- **Business vs infrastructure classification** — validation errors don't trip the circuit
- **Typed fallback** — you know exactly which failure mode triggered the fallback

---

## Next steps

### Go deeper on these packages
- [Result — full API reference](/packages/result) — `map`, `flatMap`, `andThen`, `retry`, `withTimeout`, `parallel`
- [Circuit Breaker — full API reference](/packages/circuit-breaker) — slow call detection, `CircuitBreakerRegistry`, `HALF_OPEN` probing

### Add more resilience
- [Bulkhead](/packages/bulkhead) — limit concurrency to a downstream; queue the overflow
- [HTTP Client](/packages/http-client) — axios wrapper where every call returns `Result<T, E>`, circuit breaker and retry built in

### Close the feedback loop
- [Auto-Learning](/packages/auto-learning) — monitors real traffic and automatically adjusts your circuit breaker thresholds, bulkhead concurrency, and timeouts

### NestJS integration
Every package has a `/nestjs` subpath with modules, guards, interceptors, and decorators. Import only what you use — everything else is tree-shaken.

```bash
npm install @nestjs/common @nestjs/core rxjs
```

```typescript
// app.module.ts
import { CircuitBreakerModule } from '@backendkit-labs/circuit-breaker/nestjs';
import { BulkheadModule }       from '@backendkit-labs/bulkhead/nestjs';
import { ObservabilityModule }  from '@backendkit-labs/observability';

@Module({
  imports: [
    ObservabilityModule.forRoot({ serviceName: 'my-api', environment: 'production' }),
    CircuitBreakerModule,
    BulkheadModule,
  ],
})
export class AppModule {}
```

---

## All packages

| Package | Version | What it solves |
|---------|---------|----------------|
| [`@backendkit-labs/result`](/packages/result) | `0.2.0` | Explicit, typed errors — no try/catch |
| [`@backendkit-labs/circuit-breaker`](/packages/circuit-breaker) | `0.2.0` | Stops cascading failures from external dependencies |
| [`@backendkit-labs/bulkhead`](/packages/bulkhead) | `0.2.0` | Concurrency limiting and queue-based load shedding |
| [`@backendkit-labs/pipeline`](/packages/pipeline) | `0.2.0` | Typed async middleware chains — stop-on-first or collect-all |
| [`@backendkit-labs/http-client`](/packages/http-client) | `0.2.0` | HTTP client where every call returns Result — retry + CB built in |
| [`@backendkit-labs/observability`](/packages/observability) | `0.1.1` | Structured logging, metrics, correlation ID, OTel for NestJS |
| [`@backendkit-labs/request-scanner`](/packages/request-scanner) | `0.1.5` | Embedded WAF — SQLi, XSS, NoSQL injection and more |
| [`@backendkit-labs/auto-learning`](/packages/auto-learning) | `0.1.1` | Auto-tunes CB, bulkhead, and HTTP client from real traffic |
| [`@backendkit-labs/console-animations`](/packages/console-animations) | `0.1.3` | Terminal animations for Node.js CLI tools |

---

Questions? [Open a Discussion](https://github.com/BackendKit-labs/backendkit-monorepo/discussions) — Q&A is the right place before filing an issue.
