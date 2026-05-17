---
title: "From try/catch to explicit errors: a practical migration guide"
description: How to migrate incrementally to Result<T, E> without rewriting your entire codebase.
---

# From try/catch to explicit errors: a practical migration guide

`try/catch` has a problem that only becomes obvious at scale: **errors are invisible until they aren't**.

A function signature like `async function getUser(id: string): Promise<User>` tells you nothing about what can go wrong. Can it throw a `DatabaseError`? A `NetworkError`? An `UnauthorizedError`? You have to read the implementation, chase the call stack, and hope the documentation is accurate — which it usually isn't, because errors don't show up in types.

`Result<T, E>` fixes this. Errors become first-class values in the type signature. The compiler enforces that callers handle both paths. And crucially, you can adopt it incrementally — you don't need to rewrite everything at once.

---

## Why try/catch scales poorly

Consider a service that calls three external dependencies:

```typescript
async function processOrder(orderId: string): Promise<Order> {
  const user    = await getUser(orderId);      // can throw UserNotFoundError
  const payment = await chargePayment(user);   // can throw PaymentError, NetworkError
  const email   = await sendConfirmation(user); // can throw EmailError
  return buildOrder(user, payment);
}
```

What happens when `chargePayment` throws? The caller catches... something. TypeScript types the caught value as `unknown`. You cast it, you check `instanceof`, you hope. If you forget the catch, the error propagates silently up the stack.

The deeper problem: **there's no way to enforce at the type level that errors were handled**. The compiler won't catch a missing `try/catch`.

---

## The migration strategy: start at the boundary

The best migration path is outside-in. Start wrapping at the places where errors enter your system — calls to databases, external APIs, third-party SDKs — and work inward.

**Week 1 goal:** no raw `await` on external calls. Use `run()` at the boundary.

```typescript
import { run } from '@backendkit-labs/result';

// Before
const user = await db.users.findById(id); // throws on not found

// After — run() wraps the throw into a Result
const result = await run(() => db.users.findById(id));
if (!result.ok) {
  // result.error is the caught exception — handle it here, not somewhere up the stack
  return handleNotFound(result.error);
}
const user = result.value; // TypeScript knows this is User
```

`run()` is your adapter layer. It doesn't force you to refactor your entire codebase — just the call sites you control.

---

## Step 2: convert internal throws to fail()

Once your boundaries are wrapped, start converting functions that throw into functions that return `Result`:

```typescript
// Before
async function findUser(id: string): Promise<User> {
  const user = await db.users.findById(id);
  if (!user) throw new UserNotFoundError(id);
  return user;
}

// After
import { ok, fail } from '@backendkit-labs/result';

async function findUser(id: string): Promise<Result<User, UserNotFoundError>> {
  const user = await db.users.findById(id);
  if (!user) return fail(new UserNotFoundError(id));
  return ok(user);
}
```

The function signature now documents what can go wrong. Callers know `UserNotFoundError` is possible without reading the body.

---

## Step 3: compose with map and andThen

Once multiple functions return `Result`, you can chain them without nested `if` blocks:

```typescript
import { andThen, map } from '@backendkit-labs/result';

const result = await findUser(id)
  .then(r => andThen(r, user => chargePayment(user)))
  .then(r => map(r, payment => ({ userId: id, payment })));

// Or with the pipe-friendly API:
const result = await pipe(
  await findUser(id),
  r => andThen(r, chargePayment),
  r => map(r, toOrderSummary),
);
```

Each step only runs if the previous succeeded. Errors short-circuit automatically.

---

## Step 4: handle at the edge

The `match()` function is your exit point — where `Result` becomes a response, a log entry, or a thrown exception for the framework to catch:

```typescript
import { match } from '@backendkit-labs/result';

const response = match(result, {
  ok:   (order) => ({ status: 201, body: order }),
  fail: (error) => error instanceof UserNotFoundError
    ? { status: 404, body: { message: error.message } }
    : { status: 500, body: { message: 'Internal error' } },
});
```

One place. All error paths visible. No silent swallows.

---

## What to migrate first

Not all code is equally worth migrating. Prioritize in this order:

1. **External API calls** — most likely to fail in production; highest value from explicit errors
2. **Database queries** — not-found and constraint errors are business-relevant
3. **Auth and validation** — rejection paths are the happy path for security
4. **Internal utilities** — lowest priority; migrate when they cause noise

Leave framework callbacks (`express` handlers, NestJS interceptors) as-is. They have their own error handling conventions.

---

## Incremental adoption in practice

The key insight: **`Result` and `try/catch` can coexist**. You don't need a big-bang migration. A service that wraps 10 external calls with `run()` is already better than one that wraps zero — even if 80% of the codebase still uses `try/catch`.

Pick one service, wrap its external calls this sprint, and measure. The value compounds as more of the codebase adopts the pattern.

---

## Next steps

- [`@backendkit-labs/result` — full API reference](/packages/result): `map`, `flatMap`, `andThen`, `orElse`, `retry`, `withTimeout`, `parallel`
- [Getting Started guide](/guide/getting-started): how `result` composes with `circuit-breaker`
- [Why we built our own Result type](/blog/why-result): the design decisions behind the API
