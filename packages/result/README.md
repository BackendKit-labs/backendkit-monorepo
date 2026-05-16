# @backendkit-labs/result

[![npm version](https://img.shields.io/npm/v/@backendkit-labs/result?style=flat-square&color=cb3837)](https://www.npmjs.com/package/@backendkit-labs/result)
[![CI](https://img.shields.io/github/actions/workflow/status/BackendKit-labs/backendkit-monorepo/ci.yml?style=flat-square&label=CI)](https://github.com/BackendKit-labs/backendkit-monorepo/actions/workflows/ci.yml)
[![License](https://img.shields.io/npm/l/@backendkit-labs/result?style=flat-square)](LICENSE)
[![Node](https://img.shields.io/node/v/@backendkit-labs/result?style=flat-square)](package.json)
[![Docs](https://img.shields.io/badge/docs-backendkitlabs.dev-4f7eff?style=flat-square)](https://backendkitlabs.dev/docs/result/)

> Type-safe Result monad for Node.js. Generic error types, observability, resilience, and optional NestJS integration. Zero runtime dependencies.

Replaces `try/catch` with an explicit, composable type that makes errors visible in the type system. Every operation either succeeds (`ok`) or fails (`fail`) — and the TypeScript compiler enforces that you handle both.

---

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
- [Constructors](#constructors)
- [Type Guards](#type-guards)
- [Transformations](#transformations)
- [Pattern Matching](#pattern-matching)
- [Side Effects](#side-effects)
- [Unwrapping](#unwrapping)
- [Conversion](#conversion)
- [Execution — run & track](#execution--run--track)
- [Resilience](#resilience)
- [Combinators](#combinators)
- [Flow — Fluent Pipeline](#flow--fluent-pipeline)
- [NestJS Integration](#nestjs-integration)
- [Architecture](#architecture)

---

## Installation

```bash
npm install @backendkit-labs/result
```

NestJS peer dependencies (only for the `/nestjs` subpath):

```bash
npm install @nestjs/common @nestjs/core rxjs
```

---

## TypeScript Configuration

### Subpath exports (`/nestjs`)

This package uses the `exports` field in `package.json` to expose the `/nestjs` subpath. TypeScript's ability to resolve it depends on the `moduleResolution` setting in your `tsconfig.json`.

**Modern resolution (recommended) — no extra config needed:**

```json
{
  "compilerOptions": {
    "moduleResolution": "bundler"
  }
}
```

`"bundler"`, `"node16"`, and `"nodenext"` all understand the `exports` field natively. This is the recommended setting for any project using a bundler or NestJS on TypeScript ≥ 5.

**Legacy resolution (`"node"`) — add a `paths` alias:**

NestJS projects generated before ~2024 default to `"moduleResolution": "node"`, which ignores the `exports` field. Add an explicit alias so TypeScript can find the types:

```json
{
  "compilerOptions": {
    "moduleResolution": "node",
    "paths": {
      "@backendkit-labs/result/nestjs": [
        "./node_modules/@backendkit-labs/result/dist/nestjs/index"
      ]
    }
  }
}
```

> **Why?** The `"node"` resolver was designed before subpath exports existed and only reads `main`/`types` at the package root — it ignores the `exports` map entirely. The `paths` alias manually points TypeScript to the correct `.d.ts` file.

### NestJS decorator support

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

And import `reflect-metadata` once at application startup:

```typescript
// main.ts
import 'reflect-metadata';
```

> NestJS CLI scaffolds these automatically. You only need to verify them if setting up a project manually.

---

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

---

## Core Concepts

### The Result type

```typescript
type Result<T, E = Error> =
  | { readonly ok: true;  readonly value: T }
  | { readonly ok: false; readonly error: E }
```

A discriminated union — either a success with a `value` of type `T`, or a failure with an `error` of type `E`. Both branches are explicit in the type, so TypeScript will not let you access `value` without first confirming `ok === true`.

The error type `E` is fully generic. You can use anything: `Error`, `string`, a union of domain error types, or an enum.

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

Produced by `track()`. Carries the same `ok / value / error` shape as a plain `Result` plus timing and metadata — ready for logging, metrics dashboards, or distributed tracing.

---

## Constructors

### `ok(value)`

Creates a successful result.

```typescript
import { ok } from '@backendkit-labs/result';

const r = ok(42);            // Result<number, never>
const r = ok({ id: 1 });    // Result<{ id: number }, never>
const r = ok(undefined);    // Result<undefined, never>
```

### `fail(error)`

Creates a failed result.

```typescript
import { fail } from '@backendkit-labs/result';

const r = fail(new Error('network error'));   // Result<never, Error>
const r = fail('not-found');                  // Result<never, string>
const r = fail({ code: 'FORBIDDEN' });        // Result<never, { code: string }>
```

### `fromThrowable(fn, errorTransform?)`

Wraps a synchronous function that might throw. Catches any exception and converts it to a `fail`.

```typescript
import { fromThrowable } from '@backendkit-labs/result';

// Without transform — caught value is cast to E
const parsed = fromThrowable(() => JSON.parse(raw));
// Result<unknown, Error>

// With transform — convert the caught value to your domain error
const parsed = fromThrowable<Config, string>(
  () => JSON.parse(raw),
  (e) => `Invalid config: ${(e as SyntaxError).message}`,
);
// Result<Config, string>

// Practical: reading a file
const content = fromThrowable(
  () => fs.readFileSync('./config.json', 'utf-8'),
  (e) => new ConfigError('Could not read config file', { cause: e }),
);
```

### `fromPromise(promise, errorTransform?)`

Converts a Promise to a `Promise<Result<T, E>>`, catching rejections.

```typescript
import { fromPromise } from '@backendkit-labs/result';

// Wrap any existing promise
const result = await fromPromise(fetch(url).then(r => r.json()));

// With error transform
const result = await fromPromise(
  db.users.findOrThrow(id),
  (e) => e instanceof PrismaError && e.code === 'P2025'
    ? { code: 'NOT_FOUND' as const, id }
    : { code: 'DB_ERROR' as const, cause: e as Error },
);
// Result<User, { code: 'NOT_FOUND'; id: string } | { code: 'DB_ERROR'; cause: Error }>
```

### `fromNullable(value, errorOnNull)`

Converts a nullable value to a Result. Returns `ok(value)` when non-null/undefined, `fail(error)` otherwise.

```typescript
import { fromNullable } from '@backendkit-labs/result';

const user = cache.get(userId); // User | undefined

const result = fromNullable(user, { code: 'CACHE_MISS' as const });
// Result<User, { code: 'CACHE_MISS' }>

// Chaining fromNullable in a pipeline
const result = fromNullable(
  config.database?.host,
  new ConfigError('database.host is required'),
);
```

---

## Type Guards

### `isOk(result)` / `isFail(result)`

Narrow the type to the success or failure branch. After the guard, TypeScript knows the exact shape.

```typescript
import { isOk, isFail } from '@backendkit-labs/result';

const result: Result<User, UserError> = await findUser(id);

if (isOk(result)) {
  result.value.email; // ✓ TypeScript: value is User
}

if (isFail(result)) {
  result.error.code;  // ✓ TypeScript: error is UserError
}

// Useful in array filters
const users = results.filter(isOk).map(r => r.value);
```

### `isRich(result)`

Returns `true` if the result was produced by `track()` and carries observability metadata.

```typescript
import { isRich } from '@backendkit-labs/result';

const result = await track(() => fetchUser(id));
if (isRich(result)) {
  console.log(`Took ${result.durationMs}ms`);
}
```

---

## Transformations

All transformations short-circuit on failure — they skip the function and pass the `fail` result through unchanged.

### `map(result, fn)`

Transform the success value into a different type.

```typescript
import { map } from '@backendkit-labs/result';

const userResult: Result<User, Error> = await run(() => fetchUser(id));

const nameResult: Result<string, Error> = map(userResult, user => user.name);

// Chain multiple maps
const initials = map(
  map(nameResult, name => name.split(' ')),
  parts => parts.map(p => p[0]).join(''),
);
```

### `mapError(result, fn)`

Transform the error value without touching the success branch.

```typescript
import { mapError } from '@backendkit-labs/result';

// Convert infrastructure errors to domain errors
const result = mapError(
  await fromPromise(db.users.find(id)),
  (dbError) => ({
    code: 'DB_ERROR' as const,
    message: 'Failed to fetch user',
    cause: dbError,
  }),
);
// Result<User, { code: 'DB_ERROR'; message: string; cause: unknown }>

// Translate error messages
const localized = mapError(
  serviceResult,
  (e) => t(`errors.${e.code}`),
);
```

### `flatMap(result, fn)`

Chain a Result-returning function. The failure from either the original result or the chained function short-circuits the pipeline.

```typescript
import { flatMap, fromNullable } from '@backendkit-labs/result';

const orderResult = flatMap(
  await run(() => fetchUser(userId)),
  (user) => fromNullable(user.activeOrder, { code: 'NO_ACTIVE_ORDER' as const }),
);
// Result<Order, Error | { code: 'NO_ACTIVE_ORDER' }>
```

### `flatMapAsync(result, fn)`

Async version of `flatMap`.

```typescript
import { flatMapAsync } from '@backendkit-labs/result';

const profileResult = await flatMapAsync(
  await run(() => fetchUser(userId)),
  async (user) => run(() => fetchProfile(user.profileId)),
);
// Result<Profile, Error>
```

### `mapAsync(result, fn)`

Maps the success value with an async function.

```typescript
import { mapAsync } from '@backendkit-labs/result';

const enriched = await mapAsync(
  userResult,
  async (user) => ({ ...user, permissions: await loadPermissions(user.id) }),
);
// Result<User & { permissions: string[] }, Error>
```

---

## Pattern Matching

### `match(result, handlers)` / `fold(result, handlers)`

Exhaustive pattern match — the compiler ensures both branches are handled. `fold` is an alias.

```typescript
import { match } from '@backendkit-labs/result';

const response = match(result, {
  ok:   (user)  => ({ status: 200, body: user }),
  fail: (error) => ({ status: error.code === 'NOT_FOUND' ? 404 : 500, body: error }),
});

// Returning different types from each branch
const display = match(paymentResult, {
  ok:   (payment) => `Payment of $${payment.amount} confirmed`,
  fail: (error)   => `Payment failed: ${error.message}`,
});

// Logging pattern
match(result, {
  ok:   (data)  => logger.info('Operation succeeded', { data }),
  fail: (error) => logger.error('Operation failed', { error }),
});
```

---

## Side Effects

### `tap(result, fn)` / `tapError(result, fn)`

Run a side effect without altering the result. Returns the original result unchanged — useful for logging in the middle of a pipeline.

```typescript
import { tap, tapError } from '@backendkit-labs/result';

const result = tap(
  await run(() => processPayment(dto)),
  (payment) => {
    analytics.track('payment.processed', { amount: payment.amount });
    logger.info('Payment processed', payment);
  },
);
// result is still Result<Payment, Error>

// Log errors without breaking the chain
const result = tapError(
  await run(() => fetchInventory(sku)),
  (error) => logger.warn('Inventory fetch failed', { sku, error }),
);

// Combined
const result = tap(
  tapError(
    await run(() => fetchUser(id)),
    (e) => logger.error('User fetch failed', e),
  ),
  (user) => cache.set(id, user),
);
```

---

## Unwrapping

Use these when you need to extract the raw value — typically at the edge of your application (controller, CLI output, test assertions).

### `unwrap(result)` — throws on failure

```typescript
import { unwrap } from '@backendkit-labs/result';

const user = unwrap(userResult); // throws if fail
```

### `unwrapOr(result, default)` — safe fallback

```typescript
import { unwrapOr } from '@backendkit-labs/result';

const user = unwrapOr(userResult, defaultUser);
const count = unwrapOr(countResult, 0);
const items = unwrapOr(listResult, []);
```

### `unwrapOrElse(result, fn)` — computed fallback

```typescript
import { unwrapOrElse } from '@backendkit-labs/result';

const user = unwrapOrElse(
  userResult,
  (error) => error.code === 'NOT_FOUND' ? guestUser : throw error,
);
```

### `unwrapError(result)` — extract the error

```typescript
import { unwrapError } from '@backendkit-labs/result';

const error = unwrapError(failResult); // throws if ok
```

### `expect(result, message)` — custom error message

```typescript
import { expect as resultExpect } from '@backendkit-labs/result';

const config = resultExpect(
  fromThrowable(() => loadConfig()),
  'Failed to load configuration — cannot start server',
);
```

---

## Conversion

### `toPromise(result)`

```typescript
import { toPromise } from '@backendkit-labs/result';

// Bridges Result-based code with Promise-based APIs
const user = await toPromise(userResult); // rejects if fail
```

### `toNullable(result)` / `toUndefined(result)`

```typescript
import { toNullable, toUndefined } from '@backendkit-labs/result';

const user: User | null      = toNullable(userResult);
const user: User | undefined = toUndefined(userResult);

// Useful with optional chaining
const name = toNullable(userResult)?.name ?? 'Anonymous';
```

---

## Execution — `run` & `track`

### `run(fn, errorTransform?)`

Executes any async (or sync) function and captures thrown exceptions as `fail`. The cleanest way to integrate with existing throw-based code.

```typescript
import { run } from '@backendkit-labs/result';

// Wraps any async call
const result = await run(() => fetch(url).then(r => r.json()));

// With error classification
const result = await run<User, UserError>(
  () => db.users.findOrThrow(id),
  (e) => e instanceof NotFoundError
    ? { code: 'NOT_FOUND' as const, id }
    : { code: 'DB_ERROR' as const, cause: e as Error },
);

// Sync functions work too
const result = await run(() => JSON.parse(raw));
```

### `track(fn, options?)`

Like `run()` but also measures execution time and attaches metadata. Returns a `RichResult<T, E>`.

```typescript
import { track } from '@backendkit-labs/result';

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
    timestamp:  result.timestamp,    // '2026-05-13T...'
    tags:       result.tags,         // ['db', 'users']
  });
}
```

### `enrich(result, options?)` / `simplify(richResult)`

Promote a plain `Result` to `RichResult`, or strip metadata back to a plain `Result`.

```typescript
import { enrich, simplify } from '@backendkit-labs/result';

// Attach metadata to an existing result
const rich = enrich(ok(user), {
  operation:     'cache.hit',
  correlationId: reqId,
});
// RichResult<User, never>

// Strip metadata when you no longer need it
const plain = simplify(richResult);
// Result<User, Error>
```

---

## Resilience

### `retry(fn, options)`

Retries a Result-returning async function on failure.

```typescript
import { retry, run } from '@backendkit-labs/result';

// Basic retry
const result = await retry(
  () => run(() => callExternalApi()),
  { attempts: 3 },
);

// With delay between attempts
const result = await retry(
  () => run(() => sendEmail(payload)),
  { attempts: 5, delayMs: 1_000 },
);

// Stop retrying on specific errors
const result = await retry(
  () => run(() => callApi(), classifyError),
  {
    attempts:    4,
    delayMs:     500,
    shouldRetry: (error, attempt) => {
      console.log(`Attempt ${attempt} failed:`, error);
      return error.code !== 'UNAUTHORIZED'; // don't retry 401
    },
    onRetry: (error, attempt) => {
      metrics.increment('api.retry', { attempt });
    },
  },
);
```

### `retryWithBackoff(fn, options)`

Exponential backoff: delay doubles on each retry, capped at `maxDelayMs`. Supports **jitter** to prevent thundering herd when multiple instances retry simultaneously.

```typescript
import { retryWithBackoff, run } from '@backendkit-labs/result';

// 100ms → 200ms → 400ms → 800ms (capped at 1000ms)
const result = await retryWithBackoff(
  () => run(() => fetchWithFlakeyNetwork()),
  {
    attempts:   5,
    delayMs:    100,   // initial delay
    maxDelayMs: 1_000, // cap
    shouldRetry: (error) => error.retryable === true,
  },
);

// Database deadlock retry pattern
const result = await retryWithBackoff(
  () => run(() => db.transaction(fn), classifyDbError),
  {
    attempts:    3,
    delayMs:     50,
    maxDelayMs:  500,
    shouldRetry: (e) => e.code === 'DEADLOCK',
    onRetry:     (e, n) => logger.warn(`Deadlock retry #${n}`, e),
  },
);
```

#### Jitter

When many instances of your service fail at the same time (e.g. a downstream goes down), they all retry on the same schedule — creating a synchronized spike that can overwhelm the recovering service. Jitter spreads those retries across time.

```typescript
// Full jitter — delay = random(0, computedDelay)
// Maximum spread. Best for high-concurrency scenarios (many parallel clients).
await retryWithBackoff(() => run(() => callApi()), {
  attempts:   4,
  delayMs:    500,
  maxDelayMs: 10_000,
  jitter:     true,
});

// Partial jitter — delay ± (computedDelay × factor)
// Keeps delays close to the backoff curve while adding noise.
// 0.25 = ±25%: a computed 1000ms delay becomes 750ms–1250ms.
await retryWithBackoff(() => run(() => callApi()), {
  attempts:   4,
  delayMs:    500,
  maxDelayMs: 10_000,
  jitter:     0.25,
});
```

| `jitter` value | Behaviour | Use when |
|---|---|---|
| `false` / omitted | No randomness — deterministic delays | Tests, single-instance services |
| `true` | Full jitter: `random(0, delay)` | Many parallel clients retrying the same service |
| `0.0–1.0` | Partial jitter: `delay ± (delay × factor)` | You want backoff shape preserved with light noise |

### `withTimeout(fn, ms, timeoutError)`

Races a Result-returning function against a deadline.

```typescript
import { withTimeout, run } from '@backendkit-labs/result';

// Enforce SLA on external calls
const result = await withTimeout(
  () => run(() => callSlowApi()),
  5_000,
  new TimeoutError('API call exceeded 5s SLA'),
);

// With typed error
const result = await withTimeout<Report, ApiError>(
  () => run(() => generateReport(params), toApiError),
  30_000,
  { code: 'TIMEOUT', message: 'Report generation timed out' },
);

if (isFail(result) && result.error.code === 'TIMEOUT') {
  return servePartialReport();
}
```

### Combining resilience primitives

```typescript
// Retry with backoff + timeout on each attempt
const result = await withTimeout(
  () => retryWithBackoff(
    () => run(() => fetchCriticalData()),
    { attempts: 3, delayMs: 100, maxDelayMs: 500 },
  ),
  10_000,
  new Error('Gave up after 10s'),
);
```

---

## Combinators

### `all(results)` — all must succeed

Returns `ok([...values])` or the first failure.

```typescript
import { all, run } from '@backendkit-labs/result';

const [userResult, orderResult, inventoryResult] = await Promise.all([
  run(() => fetchUser(userId)),
  run(() => fetchOrder(orderId)),
  run(() => fetchInventory(sku)),
]);

const combined = all([userResult, orderResult, inventoryResult]);
// Result<[User, Order, Inventory], Error>

if (isOk(combined)) {
  const [user, order, inventory] = combined.value;
}
```

### `any(operations)` — first success wins

Tries operations sequentially, returns the first that succeeds.

```typescript
import { any, run } from '@backendkit-labs/result';

// Cache → DB fallback chain
const user = await any([
  () => run(() => cache.get(id)),
  () => run(() => replicaDb.findUser(id)),
  () => run(() => primaryDb.findUser(id)),
]);
```

### `parallel(operations, options?)` — concurrent execution

Runs all operations concurrently (with optional concurrency limit). Returns all values or the first failure.

```typescript
import { parallel, run } from '@backendkit-labs/result';

// Process all at once
const result = await parallel(
  userIds.map(id => () => run(() => fetchUser(id))),
);
// Result<User[], Error>

// Limit concurrency to avoid overwhelming downstream
const result = await parallel(
  imageIds.map(id => () => run(() => processImage(id))),
  { concurrency: 5 },
);

if (isOk(result)) {
  const users: User[] = result.value;
}
```

### `partition(results)` — split successes and failures

```typescript
import { partition } from '@backendkit-labs/result';

const results = await Promise.all(ids.map(id => run(() => fetchUser(id))));
const [users, errors] = partition(results);
// users: User[]   — all successful values
// errors: Error[] — all failure values

logger.info(`Fetched ${users.length} users, ${errors.length} failed`);
```

### `collect(results)` — success values only

Like `partition` but silently drops failures.

```typescript
import { collect } from '@backendkit-labs/result';

const results = await Promise.all(ids.map(id => run(() => fetchUser(id))));
const users = collect(results);
// User[] — failures are discarded
```

### `traverse(items, fn)` — map array through a Result function

Applies a Result-returning function to each item. Succeeds only if all items succeed (short-circuits on the first failure).

```typescript
import { traverse, fromNullable } from '@backendkit-labs/result';

// Validate every item in an array
const result = traverse(
  requestBody.items,
  (item) => fromNullable(
    catalog.get(item.sku),
    { code: 'SKU_NOT_FOUND' as const, sku: item.sku },
  ),
);
// Result<CatalogItem[], { code: 'SKU_NOT_FOUND'; sku: string }>

// Parse and validate a list of inputs
const result = traverse(
  rawIds,
  (id) => id.match(/^\d+$/)
    ? ok(parseInt(id, 10))
    : fail(`Invalid ID format: ${id}`),
);
```

### `combine2(r1, r2)` / `combine3(r1, r2, r3)` — typed tuples

Combines two or three results into a precisely typed tuple. Short-circuits on the first failure.

```typescript
import { combine2, combine3, run } from '@backendkit-labs/result';

const result = combine2(
  await run(() => fetchUser(userId)),
  await run(() => fetchAccount(accountId)),
);
// Result<[User, Account], Error>

if (isOk(result)) {
  const [user, account] = result.value; // fully typed
}

// Three results
const result = combine3(
  await run(() => fetchUser(userId)),
  await run(() => fetchPermissions(userId)),
  await run(() => fetchSettings(userId)),
);
// Result<[User, Permission[], Settings], Error>
```

---

## Flow — Fluent Pipeline

`Flow<T, E>` is a composable wrapper that lets you build transformation pipelines. Each step is skipped if the result is already a failure.

### Starting a pipeline

```typescript
import { Flow, ok, fail } from '@backendkit-labs/result';

// From an existing result
const flow = Flow.from(ok(42));
Flow.from(await run(() => fetchUser(id)));

// Empty pipeline (value is void)
Flow.start().map(() => loadConfig());
```

### `.map(fn)` / `.mapError(fn)`

```typescript
const result = Flow.from(await run(() => fetchUser(id)))
  .map(user => user.profile)
  .map(profile => profile.avatar ?? defaultAvatar)
  .getResult();
// Result<string, Error>

// Transform errors along the way
const result = Flow.from(await run(() => callExternalApi(), toRawError))
  .mapError(raw => new DomainError(raw.message, raw.code))
  .getResult();
```

### `.flatMap(fn)`

```typescript
const orderResult = Flow.from(await run(() => fetchUser(userId)))
  .flatMap(user =>
    user.activeOrderId
      ? ok(user.activeOrderId)
      : fail(new Error('No active order')),
  )
  .flatMap(orderId => fromNullable(ordersCache.get(orderId), new Error('Cache miss')))
  .getResult();
```

### `.filter(predicate, error)`

```typescript
const result = Flow.from(ok(age))
  .filter(a => a >= 18,       new Error('Must be 18 or older'))
  .filter(a => a <= 120,      new Error('Age value is unrealistic'))
  .map(a => categorizeAge(a))
  .getResult();
```

### `.tap(fn)` / `.tapError(fn)`

```typescript
const result = Flow.from(await run(() => processPayment(dto)))
  .tap(payment => analytics.track('payment.success', payment))
  .tap(payment => cache.invalidate(`balance:${payment.userId}`))
  .tapError(err => logger.error('Payment failed', err))
  .tapError(err => metrics.increment('payment.failure'))
  .getResult();
```

### `.recover(fn)`

Convert a failure into a success — useful for providing defaults.

```typescript
const result = Flow.from(await run(() => fetchFromPrimary(key)))
  .recover(error => {
    logger.warn('Primary failed, using default', error);
    return defaultValue;
  })
  .getResult();
// Result<T, never> — failure branch is eliminated
```

### `.match(handlers)`

Terminate the pipeline with an exhaustive match.

```typescript
const httpResponse = Flow.from(await run(() => processRequest(req)))
  .map(data => ({ status: 200, body: data }))
  .match({
    ok:   (response) => response,
    fail: (error)    => ({ status: 500, body: { message: error.message } }),
  });
```

### Full pipeline example

```typescript
const response = await Flow.from(
    await track(
      () => db.users.findOrThrow(userId),
      { operation: 'user.fetch', tags: ['db'] },
    ),
  )
  .tapError(e => logger.error('User not found', e))
  .flatMap(user =>
    user.isActive
      ? ok(user)
      : fail(new ForbiddenError('Account suspended')),
  )
  .map(user => ({
    id:    user.id,
    name:  user.name,
    email: user.email,
  }))
  .tap(dto => cache.set(`user:${userId}`, dto, { ttl: 60 }))
  .match({
    ok:   (dto)   => ({ statusCode: 200, data: dto }),
    fail: (error) => ({
      statusCode: error instanceof ForbiddenError ? 403 : 404,
      message:    error.message,
    }),
  });
```

---

## NestJS Integration

Import from the `/nestjs` subpath.

```typescript
import { ResultModule } from '@backendkit-labs/result/nestjs';

@Module({ imports: [ResultModule] })
export class AppModule {}
```

### `@AsResult(operation?)` — wrap method in `run()`

Any exception thrown inside the method becomes a `fail`. The return type becomes `Promise<Result<T, E>>`.

```typescript
import { AsResult } from '@backendkit-labs/result/nestjs';
import { ok, fail, isOk } from '@backendkit-labs/result';

@Injectable()
export class UserService {
  @AsResult('user.find')
  async findOne(id: string): Promise<User> {
    return this.db.users.findOrThrow(id); // throws → becomes fail()
  }
}

// In the controller
const result = await this.userService.findOne(id);
// Result<User, Error>
if (isOk(result)) {
  return result.value;
}
```

### `@WithMetrics(options?)` — wrap method in `track()`

Like `@AsResult()` but returns a `RichResult` with timing and metadata.

```typescript
import { WithMetrics } from '@backendkit-labs/result/nestjs';
import { isOk } from '@backendkit-labs/result';

@Injectable()
export class PaymentService {
  @WithMetrics({ operation: 'payment.charge', tags: ['stripe'] })
  async charge(dto: ChargeDto): Promise<Payment> {
    return this.stripeClient.charges.create({
      amount:   dto.amount,
      currency: dto.currency,
    });
  }
}

// In the controller
const result = await this.paymentService.charge(dto);
// RichResult<Payment, Error>

logger.info('Charge result', {
  ok:         result.ok,
  operation:  result.operation,   // 'payment.charge'
  durationMs: result.durationMs,  // e.g. 340
  tags:       result.tags,        // ['stripe']
});
```

### `ResultInterceptor` — HTTP response normalization

Automatically converts `Result` and `RichResult` return values from controller methods into a consistent JSON response shape.

```typescript
import { ResultInterceptor } from '@backendkit-labs/result/nestjs';

// Global — applies to every controller
app.useGlobalInterceptors(app.get(ResultInterceptor));

// Or per-controller / per-route
@UseInterceptors(ResultInterceptor)
@Controller('users')
export class UsersController { ... }
```

**Response shape for plain `Result`:**

```json
// Ok
{ "ok": true, "data": { "id": 1, "name": "Alice" } }

// Fail
{ "ok": false, "error": "User not found" }
```

**Response shape for `RichResult`:**

```json
// Ok
{
  "ok": true,
  "data": { "id": 1, "name": "Alice" },
  "meta": {
    "operation":     "user.find",
    "durationMs":    12,
    "timestamp":     "2026-05-13T20:00:00.000Z",
    "correlationId": "req-abc-123",
    "tags":          ["db", "users"]
  }
}

// Fail
{
  "ok": false,
  "error": "User not found",
  "meta": {
    "operation":  "user.find",
    "durationMs": 3,
    "timestamp":  "2026-05-13T20:00:00.001Z"
  }
}
```

Non-Result return values (plain objects, arrays, primitives) pass through unchanged.

### Full NestJS controller example

```typescript
import { Controller, Get, Post, Param, Body, UseInterceptors } from '@nestjs/common';
import { ResultInterceptor } from '@backendkit-labs/result/nestjs';
import { ok, fail, run, match, isOk } from '@backendkit-labs/result';

@UseInterceptors(ResultInterceptor)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  async charge(@Body() dto: ChargeDto) {
    // RichResult normalized automatically by ResultInterceptor
    return this.paymentService.charge(dto);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const result = await this.paymentService.findOne(id);

    // Handle 404 before returning — interceptor normalizes the rest
    return match(result, {
      ok:   (payment) => ok(payment),
      fail: (error)   => error.code === 'NOT_FOUND'
        ? fail(`Payment ${id} not found`)
        : fail('Internal error'),
    });
  }
}
```

---

## Architecture

```
@backendkit-labs/result                (core — zero runtime dependencies)
  Result<T, E>                         discriminated union, fully generic error type
  RichResult<T, E>                     Result + durationMs, timestamp, operation, tags
  ok() / fail()                        constructors
  fromThrowable() / fromPromise()      exception capture
  fromNullable()                       null/undefined coercion
  isOk() / isFail() / isRich()         type guards
  map() / mapError() / flatMap()       transformations
  match() / fold()                     pattern matching
  tap() / tapError()                   side effects
  unwrap() / unwrapOr() / expect()     unwrapping
  toPromise() / toNullable()           conversion
  run() / track()                      async execution with error capture
  enrich() / simplify()                RichResult promotion / demotion
  retry() / retryWithBackoff()         resilience — retries
  withTimeout()                        resilience — deadline enforcement
  all() / any() / parallel()           combinators — multiple results
  partition() / collect() / traverse() combinators — array operations
  combine2() / combine3()              combinators — typed tuples
  Flow<T, E>                           fluent pipeline builder

@backendkit-labs/result/nestjs         (optional NestJS layer)
  @AsResult()                          method decorator → run()
  @WithMetrics()                       method decorator → track()
  ResultInterceptor                    HTTP response normalization
  ResultModule                         NestJS module
```

The core is a pure TypeScript library with no runtime dependencies. The NestJS layer lives in a separate subpath export (`/nestjs`) and is tree-shaken from the core bundle.

---

## License

Apache-2.0 — [BackendKit Labs](https://github.com/BackendKit-labs)
