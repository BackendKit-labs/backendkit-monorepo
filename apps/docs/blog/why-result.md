---
title: "Why we built our own Result type (and what we learned from neverthrow)"
description: neverthrow is excellent. We still built our own. Here's the honest tradeoff.
---

# Why we built our own Result type (and what we learned from neverthrow)

`neverthrow` is a well-designed library. Before building our own Result type, we used it. This post explains what we needed that wasn't there — and where `neverthrow` might actually be the better choice for you.

---

## What neverthrow gets right

`neverthrow` established the pattern for typed errors in TypeScript. Its `ResultAsync` chaining API is ergonomic, the documentation is excellent, and the ecosystem around it (type guards, serialization utilities) is mature.

If your use case is: *"I want typed errors and composable transformations"* — `neverthrow` delivers that cleanly. Zero dependencies. Stable API. Thousands of users.

---

## What we needed differently

### 1. Resilience primitives built in

`@backendkit-labs/result` ships `retry`, `retryWithBackoff`, `withTimeout`, and `parallel` as first-class combinators — not as add-ons or separate packages.

```typescript
import { retry, withTimeout, parallel } from '@backendkit-labs/result';

// Retry with exponential backoff and jitter
const result = await retry(
  () => fetchUser(id),
  { attempts: 3, delayMs: 200, backoff: 'exponential', jitter: true },
);

// Timeout with a typed error value
const result = await withTimeout(
  () => callSlowApi(),
  5000,
  new TimeoutError('callSlowApi timed out after 5s'),
);

// Fan-out with concurrency control
const results = await parallel(
  userIds.map(id => () => fetchUser(id)),
  { concurrency: 5 },
);
```

With `neverthrow`, you'd reach for `p-retry`, `p-timeout`, and `p-limit` separately. They're good packages — but you're now assembling a pipeline from four different libraries, each with its own conventions.

### 2. Native integration with the rest of the suite

`circuit-breaker`, `bulkhead`, `pipeline`, and `http-client` all speak the same `Result<T, E>` type. No adapters, no mapping, no glue code.

```typescript
// cb.execute() returns Promise<T> — run() wraps it to Result<T, E>
const result = await run(() => cb.execute(() => fetchUser(id)));

// pipeline steps return StepResult<TContext, TError> — same discriminated union
const pipelineResult = await pipeline<Ctx, AppError>()
  .pipe(validateStep)
  .pipe(enrichStep)
  .run(initialCtx);
// pipelineResult is Result<Ctx, AppError> — same type, same match()
```

This is the difference between a library and a suite: the error model is shared, not bolted together.

### 3. A simpler surface area

`neverthrow` has two core types: `Result` and `ResultAsync`. `ResultAsync` has methods like `.map()`, `.mapErr()`, `.andThen()` that chain on the monadic container.

We made a deliberate choice to keep `Result` as a plain discriminated union — no class, no prototype chain, no method chaining on the value:

```typescript
// @backendkit-labs/result — plain object, function-based API
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

const result = ok(42);
const mapped = map(result, x => x * 2);  // function, not method
```

This makes `Result` completely transparent to serialization, logging, and frameworks. You can `JSON.stringify` a `Result` and get back something meaningful. You can spread it, clone it, store it in Redux. No hidden state, no prototype baggage.

The tradeoff: method chaining is more ergonomic for long pipelines. If you chain 5+ transformations frequently, `neverthrow`'s `.andThen().map().mapErr()` reads better than `andThen(andThen(map(result, f), g), h)`. Use the `pipe()` utility or the `Flow` API in those cases.

---

## When to use neverthrow instead

Choose `neverthrow` if:

- You want a battle-tested, widely-adopted library with a large community
- Your team already knows it and you don't need the resilience combinators
- You primarily need method chaining for long transformation pipelines
- You're not using the rest of the BackendKit suite

Choose `@backendkit-labs/result` if:

- You want `retry`, `withTimeout`, and `parallel` without additional dependencies
- You're using `circuit-breaker`, `pipeline`, or `http-client` from this suite
- You prefer function-based composition over method chaining
- You need the result to be a plain, serializable object

---

## The honest summary

We didn't build this because `neverthrow` is bad. We built it because we needed a Result type that was the connective tissue of an entire resilience suite — not a standalone utility. The resilience primitives, the shared error model across packages, and the plain-object design all follow from that goal.

If you're only picking one package from BackendKit, pick this one and evaluate whether it fits. If you're already using `neverthrow`, there's no urgent reason to migrate unless you start pulling in other packages from this suite.

---

## Next steps

- [`@backendkit-labs/result` — full API reference](/packages/result): complete combinators, Flow API, NestJS integration
- [From try/catch to explicit errors](/blog/try-catch-to-result): incremental migration guide
- [Getting Started guide](/guide/getting-started): how `result` composes with `circuit-breaker`
