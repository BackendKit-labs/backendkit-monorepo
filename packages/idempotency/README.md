# @backendkit-labs/idempotency

[![npm version](https://img.shields.io/npm/v/@backendkit-labs/idempotency?style=flat-square&color=cb3837)](https://www.npmjs.com/package/@backendkit-labs/idempotency)
[![CI](https://img.shields.io/github/actions/workflow/status/BackendKit-labs/backendkit-monorepo/ci.yml?style=flat-square&label=CI)](https://github.com/BackendKit-labs/backendkit-monorepo/actions/workflows/ci.yml)
[![License](https://img.shields.io/npm/l/@backendkit-labs/idempotency?style=flat-square)](LICENSE)
[![Node](https://img.shields.io/node/v/@backendkit-labs/idempotency?style=flat-square)](package.json)
[![Docs](https://img.shields.io/badge/docs-backendkitlabs.dev-4f7eff?style=flat-square)](https://backendkitlabs.dev/docs/idempotency/)

> Idempotency key enforcement for NestJS — replay cached responses, prevent duplicate mutations.

A client that retries a timed-out `POST /orders` request should not create two orders. This library intercepts duplicate requests at the HTTP layer, returns the original response from a store, and sets an `Idempotent-Replayed: true` header so the client knows it received a cached result — without any changes to your business logic.

Key design decisions: the **composite key** (`METHOD:path:client-key`) isolates the same client key across different endpoints. The **store interface** is pluggable — `InMemoryIdempotencyStore` works out of the box; `RedisIdempotencyStore` uses `SET NX EX` (a single atomic command) to prevent race conditions across multiple instances. When a handler throws, the key is **deleted from the store** so the client can retry with the same key.

---

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
  - [Key Lifecycle](#key-lifecycle)
  - [Composite Key](#composite-key)
  - [Pending Conflict Strategies](#pending-conflict-strategies)
  - [Key Validation](#key-validation)
- [Module Setup](#module-setup)
  - [forRoot()](#forroot)
  - [forRootAsync()](#forrootasync)
  - [Module Options Reference](#module-options-reference)
- [@Idempotent() Decorator](#idempotent-decorator)
- [Store Implementations](#store-implementations)
  - [InMemoryIdempotencyStore](#inmemoryidempotencystore)
  - [RedisIdempotencyStore](#redisidempotencystore)
  - [Custom Store](#custom-store)
- [Error Reference](#error-reference)
- [Response Headers](#response-headers)
- [Architecture](#architecture)

---

## Installation

```bash
npm install @backendkit-labs/idempotency
```

Peer dependencies:

```bash
npm install @nestjs/common @nestjs/core rxjs
```

---

## TypeScript Configuration

```json
{
  "compilerOptions": {
    "moduleResolution": "bundler",
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

---

## Quick Start

**1. Register the module (once, in `AppModule`):**

```typescript
import { IdempotencyModule } from '@backendkit-labs/idempotency';

@Module({
  imports: [
    IdempotencyModule.forRoot({
      ttlSeconds:      86_400,  // cache responses for 24 h
      pendingStrategy: 'reject', // 409 while in-flight (default)
    }),
  ],
})
export class AppModule {}
```

**2. Decorate the endpoints that need protection:**

```typescript
import { Idempotent } from '@backendkit-labs/idempotency';

@Controller('orders')
export class OrdersController {
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Idempotent()
  async createOrder(@Body() dto: CreateOrderDto) {
    return this.ordersService.createOrder(dto);
  }
}
```

**3. Clients send the `Idempotency-Key` header:**

```http
POST /orders HTTP/1.1
Content-Type: application/json
Idempotency-Key: order-checkout-7f3a9b

{ "customerId": "cust-42", "items": [...] }
```

First call → `201 Created` with the order body.  
Same key again → `201 Created` with the exact same body + `Idempotent-Replayed: true`.

---

## Core Concepts

### Key Lifecycle

```
Client sends request with Idempotency-Key
         │
         ▼
  Key exists in store?
  ├── YES, status=completed → replay cached response (skip handler)
  ├── YES, status=pending   → apply pendingStrategy (reject 409 / replay 202)
  └── NO  ─────────────────────────────────────────────────────────────┐
              Atomically insert pending record                          │
                       │                                               │
                       ▼                                               │
              Execute handler                                          │
              ├── SUCCESS → store.complete(key, statusCode, body) ─────┤
              └── ERROR   → store.delete(key)   ← client can retry ◄──┘
```

On success, the store entry transitions from `pending` → `completed` with the response body and status code persisted. On error, the key is deleted so the client can retry with the same idempotency key (the error was not a successful response, so there's nothing to replay).

### Composite Key

The internal store key is always `METHOD:path:client-key`:

```
POST:/orders:order-checkout-7f3a9b
POST:/payments/charge:order-checkout-7f3a9b
```

The same client-supplied key is therefore **isolated per endpoint**. A client can reuse `order-checkout-7f3a9b` across `/orders` and `/payments/charge` without collision.

### Pending Conflict Strategies

When two requests with the same key arrive concurrently (before the first one completes), the second sees a `pending` record. The behavior depends on `pendingStrategy`:

| Strategy | Response | Use when |
|----------|----------|----------|
| `'reject'` (default) | `409 Conflict` with a descriptive message | Client should wait and retry — safest for mutations |
| `'replay'` | `202 Accepted` + `Retry-After: 1` | Client will poll until it gets the real response |

```typescript
// Per-endpoint override
@Idempotent({ pendingStrategy: 'replay' })
async createOrder(@Body() dto: CreateOrderDto) { ... }
```

### Key Validation

The `Idempotency-Key` header is validated before the store is touched:

| Condition | Response |
|-----------|----------|
| Header missing | `422 Unprocessable Entity` |
| Header present but not 1–256 printable ASCII characters | `422 Unprocessable Entity` |
| Valid key, first request | `2xx` (your handler's response) |
| Valid key, cached response | `2xx` + `Idempotent-Replayed: true` |

---

## Module Setup

### `forRoot()`

Synchronous setup with a plain options object:

```typescript
import { IdempotencyModule } from '@backendkit-labs/idempotency';

IdempotencyModule.forRoot({
  ttlSeconds:      3_600,   // 1 hour
  pendingStrategy: 'reject',
  keyHeader:       'idempotency-key', // default — clients send this header
})
```

### `forRootAsync()`

Asynchronous setup — useful when options come from `ConfigService` or another injectable:

```typescript
import { IdempotencyModule } from '@backendkit-labs/idempotency';
import { ConfigService } from '@nestjs/config';

IdempotencyModule.forRootAsync({
  imports:    [ConfigModule],
  inject:     [ConfigService],
  useFactory: (config: ConfigService) => ({
    ttlSeconds:      config.get<number>('IDEMPOTENCY_TTL_SECONDS', 86_400),
    pendingStrategy: config.get<'reject' | 'replay'>('IDEMPOTENCY_PENDING_STRATEGY', 'reject'),
  }),
})
```

### Module Options Reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `ttlSeconds` | `number` | `86400` | How long to cache a completed response (24 h). |
| `pendingStrategy` | `'reject' \| 'replay'` | `'reject'` | What to do when a request arrives while an identical one is in-flight. |
| `keyHeader` | `string` | `'idempotency-key'` | HTTP header name to read the idempotency key from. |

`IdempotencyModule` is registered as **global** — import it once in `AppModule` and `@Idempotent()` is available everywhere.

---

## `@Idempotent()` Decorator

Applied to individual controller methods. Routes **without** this decorator are completely unaffected — the interceptor does nothing.

```typescript
import { Idempotent } from '@backendkit-labs/idempotency';

@Controller('orders')
export class OrdersController {
  // Uses module defaults
  @Post()
  @Idempotent()
  async createOrder(@Body() dto: CreateOrderDto) { ... }

  // Per-endpoint TTL override
  @Post('bulk')
  @Idempotent({ ttlSeconds: 300 })
  async bulkCreate(@Body() dto: BulkCreateDto) { ... }

  // Per-endpoint strategy override
  @Post('async-job')
  @Idempotent({ pendingStrategy: 'replay' })
  async startJob(@Body() dto: JobDto) { ... }
}
```

`@Idempotent()` options:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `ttlSeconds` | `number` | module default | Per-endpoint TTL override. |
| `pendingStrategy` | `'reject' \| 'replay'` | module default | Per-endpoint pending strategy override. |

---

## Store Implementations

### `InMemoryIdempotencyStore`

The default store. No configuration needed — registered automatically by `IdempotencyModule.forRoot()`.

```typescript
// Used automatically, no setup required
IdempotencyModule.forRoot({ ttlSeconds: 3600 })
```

**Characteristics:**
- Entries expire lazily on the next access (no background timer).
- Safe under Node.js's single-threaded execution model — `setIfAbsent` is atomic without locks.
- **Not suitable for multiple instances** — each process has its own map. Use `RedisIdempotencyStore` in production.
- Does not survive restarts — entries are lost on process exit.

### `RedisIdempotencyStore`

For production deployments with multiple instances. Atomicity guaranteed by a single `SET key value NX EX ttl` command — no `GET` + `SET` race condition.

```typescript
import { IdempotencyModule, RedisIdempotencyStore, IDEMPOTENCY_STORE } from '@backendkit-labs/idempotency';
import { createClient } from 'redis';

// node-redis adapter
const redis = createClient({ url: process.env.REDIS_URL });
await redis.connect();

IdempotencyModule.forRoot({
  ttlSeconds: 86_400,
  // Override the default InMemoryStore with Redis
  // (inject the store via IDEMPOTENCY_STORE token in forRootAsync)
})
```

For full Redis store setup, use `forRootAsync` and inject your Redis client:

```typescript
import { IdempotencyModule, RedisIdempotencyStore, IDEMPOTENCY_STORE } from '@backendkit-labs/idempotency';

@Module({
  imports: [
    IdempotencyModule.forRootAsync({
      imports:    [RedisModule],
      inject:     [REDIS_CLIENT],
      useFactory: (redisClient) => ({
        ttlSeconds: 86_400,
      }),
    }),
  ],
  providers: [
    {
      provide:  IDEMPOTENCY_STORE,
      inject:   [REDIS_CLIENT],
      useFactory: (redisClient) => new RedisIdempotencyStore(redisClient),
    },
  ],
})
export class AppModule {}
```

`RedisIdempotencyStore` expects a client that satisfies the minimal `RedisClient` interface:

```typescript
interface RedisClient {
  set(key: string, value: string, options: { nx: boolean; ex: number }): Promise<string | null>;
  get(key: string): Promise<string | null>;
  setex(key: string, seconds: number, value: string): Promise<unknown>;
  del(key: string): Promise<unknown>;
}
```

Both `ioredis` and `node-redis` satisfy this interface.

### Custom Store

Implement the `IdempotencyStore` interface to plug in any persistence layer (DynamoDB, Postgres, Memcached):

```typescript
import type { IdempotencyStore, IdempotencyRecord } from '@backendkit-labs/idempotency';
import { Injectable } from '@nestjs/common';

@Injectable()
export class DynamoIdempotencyStore implements IdempotencyStore {
  async setIfAbsent(record: IdempotencyRecord, ttlSeconds: number): Promise<IdempotencyRecord | null> {
    // Attempt a conditional write — return null if inserted, existing record if key already present
  }

  async get(key: string): Promise<IdempotencyRecord | null> { ... }

  async complete(key: string, statusCode: number, body: unknown, ttlSeconds: number): Promise<void> { ... }

  async delete(key: string): Promise<void> { ... }
}
```

Then register it via the `IDEMPOTENCY_STORE` token:

```typescript
{
  provide:  IDEMPOTENCY_STORE,
  useClass: DynamoIdempotencyStore,
}
```

---

## Error Reference

All errors are standard NestJS `HttpException` subclasses and are handled by NestJS's built-in exception filter.

| Error | Status | When thrown |
|-------|--------|------------|
| `IdempotencyKeyMissingError` | `422` | The configured `keyHeader` is absent from the request |
| `IdempotencyKeyInvalidError` | `422` | The key is present but not 1–256 printable ASCII characters |
| `IdempotencyPendingConflictError` | `409` | A request with this key is already in-flight and `pendingStrategy` is `'reject'` |

```typescript
// Example 422 response body
{
  "statusCode": 422,
  "error": "Unprocessable Entity",
  "message": "Missing required header: idempotency-key"
}

// Example 409 response body
{
  "statusCode": 409,
  "error": "Conflict",
  "message": "Request with idempotency key \"order-checkout-7f3a9b\" is still in progress"
}
```

---

## Response Headers

| Header | Value | When present |
|--------|-------|-------------|
| `Idempotent-Replayed` | `true` | The response was served from the store — the handler was NOT called |
| `Retry-After` | `1` | Set on `202 Accepted` when `pendingStrategy: 'replay'` and the request is in-flight |

---

## Architecture

```
IdempotencyModule.forRoot()
  ├── registers IdempotencyInterceptor as APP_INTERCEPTOR (global)
  ├── provides InMemoryIdempotencyStore via IDEMPOTENCY_STORE token
  └── provides Reflector (required for reading @Idempotent() metadata)

IdempotencyInterceptor
  ├── reads @Idempotent() metadata via Reflector — skips routes without it
  ├── validates Idempotency-Key header (presence + format)
  ├── builds composite key: METHOD:path:client-key
  ├── store.get()         — check for existing record
  ├── store.setIfAbsent() — atomic claim (first writer wins)
  ├── next.handle()       — execute handler if key was claimed
  ├── store.complete()    — persist response on success (awaited via mergeMap)
  └── store.delete()      — release key on handler error (client can retry)

IdempotencyStore (interface)
  ├── InMemoryIdempotencyStore  — Map<string, Entry> with lazy TTL eviction
  └── RedisIdempotencyStore     — SET NX EX (atomic, no GET+SET race)
```

---

## License

Apache-2.0 — [BackendKit Labs](https://github.com/BackendKit-labs)
