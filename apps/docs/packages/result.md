---
title: Result
description: Type-safe Result monad for Node.js — generic errors, composable transformations, resilience, and NestJS integration.
---

# @backendkit-labs/result

[![npm](https://img.shields.io/npm/v/@backendkit-labs/result?style=flat-square&color=cb3837)](https://www.npmjs.com/package/@backendkit-labs/result)
[![License](https://img.shields.io/npm/l/@backendkit-labs/result?style=flat-square)](https://github.com/BackendKit-labs/backendkit-monorepo/blob/master/LICENSE)
[![Node](https://img.shields.io/node/v/@backendkit-labs/result?style=flat-square)](https://nodejs.org)

> Type-safe Result monad for Node.js. Generic error types, observability, resilience, and optional NestJS integration. Zero runtime dependencies.

Replaces `try/catch` with an explicit, composable type that makes errors visible in the type system. Every operation either succeeds (`ok`) or fails (`fail`) — and the TypeScript compiler enforces that you handle both.

## Installation

```bash
npm install @backendkit-labs/result
```

NestJS peer dependencies (only for the `/nestjs` subpath):

```bash
npm install @nestjs/common @nestjs/core rxjs
```

## Quick Start

```typescript
import { ok, fail, run, isOk, isFail, match } from '@backendkit-labs/result';

// Wrap a throwable async call
const result = await run(() => fetchUser(userId));

// Handle both branches
const message = match(result, {
  ok:   (user)  => `Welcome, ${user.name}`,
  fail: (error) => `Error: ${error.message}`,
});

// Or guard and narrow
if (isOk(result)) {
  console.log(result.value.email); // TypeScript knows value exists
}
if (isFail(result)) {
  console.error(result.error);     // TypeScript knows error exists
}
```

## Core Types

### Result

```typescript
type Result<T, E = Error> =
  | { readonly ok: true;  readonly value: T }
  | { readonly ok: false; readonly error: E }
```

A discriminated union — either a success with a `value` of type `T`, or a failure with an `error` of type `E`. The error type `E` is fully generic — use anything: `Error`, `string`, a union of domain error types, or an enum.

```typescript
// Typed errors as a discriminated union
type UserError =
  | { code: 'NOT_FOUND'; id: string }
  | { code: 'FORBIDDEN' }
  | { code: 'DB_ERROR'; cause: Error }

async function findUser(id: string): Promise<Result<User, UserError>> { ... }
```

### RichResult — with observability

```typescript
type RichResult<T, E = Error> = Result<T, E> & {
  readonly durationMs:     number   // execution time in ms
  readonly timestamp:      string   // ISO 8601 start time
  readonly operation?:     string   // logical name
  readonly correlationId?: string   // trace/request ID
  readonly tags?:          string[] // categorization labels
}
```

Produced by `track()`. Same `ok / value / error` shape as a plain `Result` plus timing and metadata — ready for logging, metrics dashboards, or distributed tracing.

## Constructors

### `ok(value)`

```typescript
const r = ok(42);         // Result<number, never>
const r = ok({ id: 1 }); // Result<{ id: number }, never>
```

### `fail(error)`

```typescript
const r = fail(new Error('network error')); // Result<never, Error>
const r = fail('not-found');                // Result<never, string>
const r = fail({ code: 'FORBIDDEN' });      // Result<never, { code: string }>
```

### `fromThrowable(fn, errorTransform?)`

Wraps a synchronous function that might throw.

```typescript
const parsed = fromThrowable<Config, string>(
  () => JSON.parse(raw),
  (e) => `Invalid config: ${(e as SyntaxError).message}`,
);
// Result<Config, string>
```

### `fromPromise(promise, errorTransform?)`

Converts a Promise to a `Promise<Result<T, E>>`, catching rejections.

```typescript
const result = await fromPromise(
  db.users.findOrThrow(id),
  (e) => e instanceof PrismaError && e.code === 'P2025'
    ? { code: 'NOT_FOUND' as const, id }
    : { code: 'DB_ERROR' as const, cause: e as Error },
);
```

### `fromNullable(value, errorOnNull)`

```typescript
const result = fromNullable(cache.get(userId), { code: 'CACHE_MISS' as const });
// Result<User, { code: 'CACHE_MISS' }>
```

## Type Guards

```typescript
if (isOk(result))   { result.value; } // TypeScript: value is T
if (isFail(result)) { result.error; } // TypeScript: error is E

// Useful in array filters
const users = results.filter(isOk).map(r => r.value);
```

`isRich(result)` — returns `true` if the result carries observability metadata from `track()`.

## Transformations

All transformations short-circuit on failure — they skip the function and pass the `fail` through unchanged.

### `map(result, fn)` — transform the value

```typescript
const nameResult: Result<string, Error> = map(userResult, user => user.name);
```

### `mapError(result, fn)` — transform the error

```typescript
const result = mapError(
  await fromPromise(db.users.find(id)),
  (dbError) => ({ code: 'DB_ERROR' as const, cause: dbError }),
);
```

### `flatMap(result, fn)` — chain a Result-returning function

```typescript
const orderResult = flatMap(
  await run(() => fetchUser(userId)),
  (user) => fromNullable(user.activeOrder, { code: 'NO_ACTIVE_ORDER' as const }),
);
```

### `flatMapAsync(result, fn)` / `mapAsync(result, fn)`

Async versions of `flatMap` and `map`.

```typescript
const profileResult = await flatMapAsync(
  await run(() => fetchUser(userId)),
  async (user) => run(() => fetchProfile(user.profileId)),
);
```

## Pattern Matching

### `match(result, handlers)` — exhaustive match

```typescript
const response = match(result, {
  ok:   (user)  => ({ status: 200, body: user }),
  fail: (error) => ({ status: error.code === 'NOT_FOUND' ? 404 : 500, body: error }),
});
```

`fold` is an alias for `match`.

## Side Effects

### `tap(result, fn)` / `tapError(result, fn)`

Run a side effect without altering the result.

```typescript
const result = tap(
  await run(() => processPayment(dto)),
  (payment) => analytics.track('payment.processed', payment),
);

const result = tapError(
  await run(() => fetchInventory(sku)),
  (error) => logger.warn('Inventory fetch failed', { sku, error }),
);
```

## Unwrapping

Use at the edge of your application (controllers, CLI output, test assertions).

```typescript
unwrap(result)                // throws on failure
unwrapOr(result, defaultUser) // safe fallback
unwrapOrElse(result, fn)      // computed fallback
unwrapError(result)           // extract the error (throws if ok)
expect(result, 'message')     // custom error message on throw
```

## Conversion

```typescript
toPromise(result)   // rejects if fail — bridges with Promise-based APIs
toNullable(result)  // User | null
toUndefined(result) // User | undefined
```

## Execution — `run` & `track`

### `run(fn, errorTransform?)`

Executes any async (or sync) function and captures thrown exceptions as `fail`.

```typescript
// Wraps any async call
const result = await run(() => fetch(url).then(r => r.json()));

// With error classification
const result = await run<User, UserError>(
  () => db.users.findOrThrow(id),
  (e) => e instanceof NotFoundError
    ? { code: 'NOT_FOUND' as const, id }
    : { code: 'DB_ERROR' as const, cause: e as Error },
);
```

### `track(fn, options?)`

Like `run()` but also measures execution time and attaches metadata. Returns a `RichResult<T, E>`.

```typescript
const result = await track(
  () => db.users.findOrThrow(id),
  {
    operation:     'user.find',
    correlationId: request.headers['x-correlation-id'],
    tags:          ['db', 'users'],
  },
);

if (result.ok) {
  logger.info('User fetched', {
    operation:  result.operation,    // 'user.find'
    durationMs: result.durationMs,   // e.g. 12
    timestamp:  result.timestamp,
  });
}
```

### `enrich(result, options?)` / `simplify(richResult)`

Promote a plain `Result` to `RichResult`, or strip metadata back to a plain `Result`.

## Resilience

### `retry(fn, options)`

Retries a Result-returning async function on failure with optional fixed delay.

```typescript
const result = await retry(
  () => run(() => callApi(), classifyError),
  {
    attempts:    4,
    delayMs:     500,
    shouldRetry: (error) => error.code !== 'UNAUTHORIZED',
    onRetry:     (error, attempt) => metrics.increment('api.retry', { attempt }),
  },
);
```

### `retryWithBackoff(fn, options)`

Exponential backoff: delay doubles on each retry, capped at `maxDelayMs`.

```typescript
// 100ms → 200ms → 400ms (capped at 1000ms)
const result = await retryWithBackoff(
  () => run(() => fetchWithFlakeyNetwork()),
  {
    attempts:    5,
    delayMs:     100,
    maxDelayMs:  1_000,
    shouldRetry: (error) => error.retryable === true,
  },
);
```

#### Jitter

When many instances of your service fail simultaneously and retry on the same schedule, they create a synchronized spike that overwhelms the recovering service. Jitter spreads those retries across time.

```typescript
// Full jitter — delay = random(0, computedDelay)
// Maximum spread. Best for high-concurrency scenarios.
await retryWithBackoff(() => run(() => callApi()), {
  attempts:   4,
  delayMs:    500,
  maxDelayMs: 10_000,
  jitter:     true,
});

// Partial jitter — delay ± (delay × factor)
// Preserves backoff shape with light noise.
// 0.25 = ±25%: 1000ms computed delay → 750ms–1250ms
await retryWithBackoff(() => run(() => callApi()), {
  attempts:   4,
  delayMs:    500,
  maxDelayMs: 10_000,
  jitter:     0.25,
});
```

| `jitter` value | Behaviour | Use when |
|---|---|---|
| `false` / omitted | No randomness — deterministic | Tests, single-instance services |
| `true` | Full jitter: `random(0, delay)` | Many parallel clients retrying the same service |
| `0.0–1.0` | Partial jitter: `delay ± (delay × factor)` | Backoff shape preserved with light noise |

### `withTimeout(fn, ms, timeoutError)`

Races a Result-returning function against a deadline.

```typescript
const result = await withTimeout(
  () => run(() => callSlowApi()),
  5_000,
  new TimeoutError('API call exceeded 5s SLA'),
);
```

### Combining resilience primitives

```typescript
// Retry with backoff + global timeout
const result = await withTimeout(
  () => retryWithBackoff(
    () => run(() => fetchCriticalData()),
    { attempts: 3, delayMs: 100, maxDelayMs: 500 },
  ),
  10_000,
  new Error('Gave up after 10s'),
);
```

## Combinators

### `all(results)` — all must succeed

Returns `ok([...values])` or the first failure.

```typescript
const combined = all([userResult, orderResult, inventoryResult]);
// Result<[User, Order, Inventory], Error>
```

### `any(operations)` — first success wins

```typescript
// Cache → DB fallback chain
const user = await any([
  () => run(() => cache.get(id)),
  () => run(() => replicaDb.findUser(id)),
  () => run(() => primaryDb.findUser(id)),
]);
```

### `parallel(operations, options?)` — concurrent execution

```typescript
const result = await parallel(
  imageIds.map(id => () => run(() => processImage(id))),
  { concurrency: 5 },
);
// Result<ProcessedImage[], Error>
```

### `partition(results)` / `collect(results)` / `traverse(items, fn)`

```typescript
const [users, errors] = partition(results); // split successes and failures
const users = collect(results);              // success values only

// map array through a Result function — fails on first failure
const result = traverse(requestBody.items, (item) =>
  fromNullable(catalog.get(item.sku), { code: 'SKU_NOT_FOUND', sku: item.sku }),
);
```

### `combine2` / `combine3` — typed tuples

```typescript
const result = combine2(userResult, accountResult);
// Result<[User, Account], Error>
```

## Flow — Fluent Pipeline

`Flow<T, E>` is a composable wrapper for chaining transformations. Each step is skipped if the result is already a failure.

```typescript
const response = await Flow.from(
    await track(
      () => db.users.findOrThrow(userId),
      { operation: 'user.fetch', tags: ['db'] },
    ),
  )
  .tapError(e => logger.error('User not found', e))
  .flatMap(user =>
    user.isActive ? ok(user) : fail(new ForbiddenError('Account suspended')),
  )
  .map(user => ({ id: user.id, name: user.name, email: user.email }))
  .tap(dto => cache.set(`user:${userId}`, dto, { ttl: 60 }))
  .match({
    ok:   (dto)   => ({ statusCode: 200, data: dto }),
    fail: (error) => ({ statusCode: error instanceof ForbiddenError ? 403 : 404, message: error.message }),
  });
```

Available pipeline methods: `.map()`, `.mapError()`, `.flatMap()`, `.filter()`, `.tap()`, `.tapError()`, `.recover()`, `.match()`, `.getResult()`

## NestJS Integration

```typescript
import { ResultModule } from '@backendkit-labs/result/nestjs';

@Module({ imports: [ResultModule] })
export class AppModule {}
```

### `@AsResult(operation?)` — wrap method in `run()`

Any exception thrown inside the method becomes a `fail`. The return type becomes `Promise<Result<T, E>>`.

```typescript
@Injectable()
export class UserService {
  @AsResult('user.find')
  async findOne(id: string): Promise<User> {
    return this.db.users.findOrThrow(id); // throws → becomes fail()
  }
}

// Usage
const result = await this.userService.findOne(id);
// Result<User, Error>
```

### `@WithMetrics(options?)` — wrap method in `track()`

Returns a `RichResult` with timing and metadata.

```typescript
@Injectable()
export class PaymentService {
  @WithMetrics({ operation: 'payment.charge', tags: ['stripe'] })
  async charge(dto: ChargeDto): Promise<Payment> {
    return this.stripeClient.charges.create(dto);
  }
}
```

### `ResultInterceptor` — HTTP response normalization

Converts `Result` and `RichResult` return values from controller methods into a consistent JSON response.

```typescript
// Global
app.useGlobalInterceptors(app.get(ResultInterceptor));
```

**Response shapes:**

```json
// Result ok
{ "ok": true, "data": { "id": 1, "name": "Alice" } }

// Result fail
{ "ok": false, "error": "User not found" }

// RichResult ok
{
  "ok": true,
  "data": { "id": 1 },
  "meta": { "operation": "user.find", "durationMs": 12, "timestamp": "…", "tags": ["db"] }
}
```

## Architecture

```
@backendkit-labs/result                (core — zero runtime dependencies)
  Result<T, E>  /  RichResult<T, E>   discriminated union types
  ok() / fail()                        constructors
  fromThrowable() / fromPromise()      exception capture
  fromNullable()                       null coercion
  isOk() / isFail() / isRich()         type guards
  map() / mapError() / flatMap()       transformations
  match() / fold()                     pattern matching
  tap() / tapError()                   side effects
  unwrap*() / expect()                 unwrapping
  toPromise() / toNullable()           conversion
  run() / track()                      async execution with error capture
  enrich() / simplify()               RichResult promotion / demotion
  retry() / retryWithBackoff()         resilience — retries
  withTimeout()                        resilience — deadline enforcement
  all() / any() / parallel()           combinators — multiple results
  partition() / collect() / traverse() combinators — array operations
  combine2() / combine3()             combinators — typed tuples
  Flow<T, E>                           fluent pipeline builder

@backendkit-labs/result/nestjs         (optional NestJS layer)
  @AsResult()                          method decorator → run()
  @WithMetrics()                       method decorator → track()
  ResultInterceptor                    HTTP response normalization
  ResultModule                         NestJS module
```
