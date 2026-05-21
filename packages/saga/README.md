# @backendkit-labs/saga

[![npm version](https://img.shields.io/npm/v/@backendkit-labs/saga.svg)](https://www.npmjs.com/package/@backendkit-labs/saga)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Node Version](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)

Production-grade distributed transaction orchestration for Node.js and NestJS microservices using the **Saga pattern**.

## Table of Contents

- [What is the Saga Pattern?](#what-is-the-saga-pattern)
- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
  - [SagaBuilder](#sagabuilder)
  - [SagaEngine](#sagaengine)
  - [Steps & Compensation](#steps--compensation)
  - [Parallel Steps](#parallel-steps)
  - [Retry Policy](#retry-policy)
  - [Pause & Resume](#pause--resume)
  - [Human Approval](#human-approval)
- [Persistence](#persistence)
  - [InMemoryStore](#inmemorystore)
  - [SqlAdapter — PostgreSQL, MySQL, SQLite](#sqladapter--postgresql-mysql-sqlite)
  - [RedisAdapter](#redisadapter)
  - [Custom Connector — MongoDB, DynamoDB, ORMs](#custom-connector--mongodb-dynamodb-orms)
- [Locking](#locking)
  - [InMemoryLock](#inmemorylock)
  - [RedisLockAdapter](#redislockadapter)
  - [Custom Lock](#custom-lock)
- [Events](#events)
- [Error Handling](#error-handling)
- [Recovery Engine](#recovery-engine)
- [NestJS Integration](#nestjs-integration)
- [Integration Adapters](#integration-adapters)
- [CLI Tool](#cli-tool)
- [Status Reference](#status-reference)

---

## What is the Saga Pattern?

A Saga is a sequence of local transactions where each step either **succeeds and advances**, or triggers **compensating transactions** (rollbacks) in reverse order for all previously completed steps. This gives you distributed consistency without distributed locks or two-phase commit.

```
Step 1 → Step 2 → Step 3 → FAIL
                  ↓
         Compensate Step 2 → Compensate Step 1
```

---

## Features

- **Declarative API** — fluent builder pattern for defining sagas
- **State machine** — 9 states with validated transitions
- **Compensation chain** — automatic reverse-order rollback on failure
- **Parallel steps** — concurrent execution with configurable concurrency limits
- **Retry policies** — exponential backoff with jitter, `BUSINESS` vs `INFRASTRUCTURE` error classification
- **Per-step and global timeouts**
- **Human approval** — steps that wait for manual sign-off
- **Pause / Resume** — interrupt and continue any saga
- **Crash recovery** — automatic recovery of abandoned sagas after a process restart
- **Pluggable persistence** — `InMemoryStore`, `SqlAdapter` (Postgres/MySQL/SQLite), `RedisAdapter`, or any custom connector
- **Pluggable locking** — `InMemoryLock`, `RedisLockAdapter`, or any custom lock
- **NestJS integration** — `@Saga()`, `@Step()`, `@Compensate()` decorators + `SagaOrchestrator` service
- **Event bus** — lifecycle events for observability and integration
- **CLI** — inspect, pause, and resume sagas from the terminal

---

## Installation

```bash
npm install @backendkit-labs/saga
```

Install optional drivers only for the adapters you use:

```bash
# SQL databases (PostgreSQL, MySQL, SQLite)
npm install pg        # PostgreSQL
npm install mysql2    # MySQL
npm install better-sqlite3  # SQLite

# Redis persistence + distributed locking
npm install ioredis

# NestJS integration
npm install @nestjs/common @nestjs/core reflect-metadata rxjs
```

---

## Quick Start

```typescript
import {
  SagaBuilder,
  SagaEngine,
  InMemoryStore,
  InMemoryLock,
  SagaEventBusImpl,
} from '@backendkit-labs/saga';
import { ok, isOk } from '@backendkit-labs/result';

const engine = new SagaEngine(
  new InMemoryStore(),
  new InMemoryLock(),
  new SagaEventBusImpl(),
);

engine.define(
  SagaBuilder.define('order-saga')
    .step({
      name: 'reserve-inventory',
      execute: async (ctx) => {
        const reserved = await inventoryService.reserve(ctx.input);
        return ok(reserved);
      },
      compensate: async (ctx) => {
        await inventoryService.release(ctx.originalOutput);
        return ok(undefined);
      },
      timeoutMs: 5000,
    })
    .step({
      name: 'charge-payment',
      execute: async (ctx) => {
        const charge = await paymentService.charge(ctx.previousOutput);
        return ok(charge);
      },
      compensate: async (ctx) => {
        await paymentService.refund(ctx.originalOutput);
        return ok(undefined);
      },
    })
    .onComplete(async (ctx) => console.log('Order completed:', ctx.sagaId))
    .onFail(async (ctx) => console.error('Order failed and compensated:', ctx.sagaId)),
);

const result = await engine.run('order-saga', { orderId: '123' });
if (isOk(result)) {
  console.log('Status:', result.value.status); // 'COMPLETED'
}
```

---

## Core Concepts

### SagaBuilder

Fluent API for composing saga definitions. All methods return `this` for chaining.

```typescript
SagaBuilder.define('my-saga')
  .step({ name: 'step-1', execute: handler, compensate: rollback })
  .step({ name: 'step-2', execute: handler })
  .parallel(
    { name: 'parallel-a', execute: handlerA },
    { name: 'parallel-b', execute: handlerB },
  )
  .withTimeout(60_000)
  .onComplete(async (ctx) => { /* ... */ })
  .onFail(async (ctx) => { /* ... */ })
  .build();
```

### SagaEngine

Central orchestrator. Receives a `SagaStore`, a `LockProvider`, and a `SagaEventBus`.

```typescript
const engine = new SagaEngine(store, lock, eventBus);

engine.define(builder);

const result = await engine.run('saga-name', inputPayload);
const instanceResult = await engine.create('saga-name', inputPayload);
const stateResult = await engine.getStatus(sagaId);

const listResult = await engine.list({
  status: SagaStatus.FAILED,
  sagaType: 'order-saga',
  limit: 50,
  offset: 0,
  createdAfter: Date.now() - 86_400_000,
});

await engine.pause(sagaId);
await engine.resume(sagaId);
```

### Steps & Compensation

Each step receives a `StepContext` and returns `Promise<SagaResult<unknown>>`.

```typescript
import type { StepContext, CompensationContext } from '@backendkit-labs/saga';

const step = {
  name: 'create-order',
  execute: async (ctx: StepContext) => {
    // ctx.sagaId         — current saga ID
    // ctx.correlationId  — trace correlation ID
    // ctx.stepName       — 'create-order'
    // ctx.attempt        — retry attempt (1 = first)
    // ctx.input          — original saga input
    // ctx.previousOutput — output from the previous step
    // ctx.metadata       — saga-level metadata bag
    try {
      const order = await db.orders.create(ctx.input);
      return ok(order);
    } catch (err) {
      return fail({ type: 'INFRASTRUCTURE_ERROR', step: ctx.stepName, cause: err, code: 'DB_ERROR' });
    }
  },
  compensate: async (ctx: CompensationContext) => {
    // ctx.originalInput  — what was passed to execute()
    // ctx.originalOutput — what execute() returned
    // ctx.failureReason  — the error that triggered compensation
    await db.orders.delete(ctx.originalOutput.id);
    return ok(undefined);
  },
  timeoutMs: 10_000,
};
```

### Parallel Steps

Steps inside `.parallel()` run concurrently. If any fails, all are compensated in reverse order.

```typescript
SagaBuilder.define('notify-saga')
  .step({ name: 'validate', execute: validateHandler })
  .parallel(
    { name: 'send-email', execute: emailHandler, compensate: cancelEmail },
    { name: 'send-sms',   execute: smsHandler,   compensate: cancelSms },
    { name: 'push-notif', execute: pushHandler },
  )
  .step({ name: 'record-audit', execute: auditHandler })
  .build();
```

### Retry Policy

Configured per-step. Only errors of the declared types are retried.

```typescript
const step = {
  name: 'call-external-api',
  execute: handler,
  retry: {
    maxAttempts: 5,
    initialBackoffMs: 500,
    backoffMultiplier: 2,
    maxBackoffMs: 15_000,
    jitter: true,
    retryOn: ['INFRASTRUCTURE_ERROR', 'STEP_TIMEOUT'],
    // BUSINESS_ERROR is never retried — triggers compensation immediately
  },
};
```

### Pause & Resume

```typescript
await engine.pause(sagaId);

const result = await engine.resume(sagaId);
if (isOk(result)) {
  console.log('Resumed — status:', result.value.status);
}
```

### Human Approval

```typescript
import { ApprovalStep } from '@backendkit-labs/saga';

const approvalStep = new ApprovalStep({
  group: 'finance-team',
  timeoutMs: 48 * 60 * 60 * 1000,
});

SagaBuilder.define('refund-saga')
  .step({ name: 'calculate-refund', execute: calculateHandler })
  .step({
    name: 'await-approval',
    requiresManualApproval: 'finance-team',
    execute: approvalStep.execute,
  })
  .step({ name: 'process-refund', execute: processHandler })
  .build();
```

---

## Persistence

The entire engine depends on a single interface. Any class that implements it works as a drop-in store.

```typescript
export interface SagaStore {
  save(state: SagaState):    Promise<SagaResult<void>>;
  load(sagaId: SagaId):      Promise<SagaResult<SagaState>>;
  list(filter?: SagaFilter): Promise<SagaResult<SagaState[]>>;
  delete(sagaId: SagaId):    Promise<SagaResult<void>>;
}
```

All built-in adapters use **optimistic locking** via the `version` field on `SagaState`.

### InMemoryStore

For development, testing, or single-process scenarios. No dependencies.

```typescript
import { InMemoryStore } from '@backendkit-labs/saga';

const store = new InMemoryStore();
```

> Data is lost on process restart. Do not use in production.

### SqlAdapter — PostgreSQL, MySQL, SQLite

A single adapter covers all SQL databases. The `dialect` option controls placeholder syntax (`$1` for Postgres, `?` for MySQL and SQLite) — the schema and query logic are identical across all three engines.

```typescript
import { SqlAdapter } from '@backendkit-labs/saga/stores/sql';
```

**PostgreSQL**

```typescript
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const store = new SqlAdapter(
  {
    query: async (sql, params) => {
      const result = await pool.query(sql, params);
      return { rows: result.rows, affectedRows: result.rowCount ?? 0 };
    },
  },
  { dialect: 'postgres' },
);
```

Run the migration before first use:

```bash
psql $DATABASE_URL \
  -f node_modules/@backendkit-labs/saga/src/persistence/migrations/postgres.sql
```

**MySQL**

```typescript
import mysql from 'mysql2/promise';

const connection = await mysql.createConnection({ uri: process.env.DATABASE_URL });

const store = new SqlAdapter(
  {
    query: async (sql, params) => {
      const [rows] = await connection.execute(sql, params);
      return {
        rows: Array.isArray(rows) ? rows as Record<string, unknown>[] : [],
        affectedRows: (rows as { affectedRows?: number }).affectedRows ?? 0,
      };
    },
  },
  { dialect: 'mysql' },
);
```

Run the migration before first use:

```bash
mysql -u user -p mydb \
  < node_modules/@backendkit-labs/saga/src/persistence/migrations/mysql.sql
```

**SQLite**

```typescript
import Database from 'better-sqlite3';

const db = new Database('sagas.db');

const store = new SqlAdapter(
  {
    query: async (sql, params) => {
      const stmt = db.prepare(sql);
      // SELECT returns rows, INSERT/UPDATE/DELETE returns RunResult
      if (sql.trimStart().toUpperCase().startsWith('SELECT')) {
        return { rows: stmt.all(params) as Record<string, unknown>[] };
      }
      const result = stmt.run(params);
      return { rows: [], affectedRows: result.changes };
    },
  },
  { dialect: 'sqlite' },
);
```

Run the migration before first use:

```bash
sqlite3 sagas.db \
  < node_modules/@backendkit-labs/saga/src/persistence/migrations/sqlite.sql
```

**`SqlClient` interface**

All three examples above wrap a driver into the same `SqlClient` interface:

```typescript
export interface SqlClient {
  query(
    sql: string,
    params?: unknown[],
  ): Promise<{
    rows: Record<string, unknown>[];
    affectedRows?: number;
  }>;
}
```

Any driver, query builder (Knex, Kysely), or ORM can be wrapped into this interface.

### RedisAdapter

For high-throughput scenarios or when you already have Redis in your stack. Supports optional TTL to auto-expire completed sagas.

```typescript
import { RedisAdapter } from '@backendkit-labs/saga/stores/redis';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

const store = new RedisAdapter(redis, {
  keyPrefix: 'saga',    // optional, default: 'saga'
  ttlSeconds: 604_800,  // optional: auto-expire after 7 days
});
```

Key schema:

| Key | Redis type | Purpose |
|-----|-----------|---------|
| `saga:state:{sagaId}` | String (JSON) | Full `SagaState` |
| `saga:index:all` | Sorted Set (score = `createdAt`) | All sagas ordered by creation time |
| `saga:index:status:{status}` | Set | Saga IDs grouped by status |
| `saga:index:type:{sagaType}` | Set | Saga IDs grouped by type |

Duck-typed `RedisClient` interface — works with `ioredis`, `@upstash/redis`, `redis` (node-redis v4), or any compatible client:

```typescript
export interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<'OK' | null>;
  expire(key: string, seconds: number): Promise<number>;
  del(key: string): Promise<number>;
  zadd(key: string, score: number, member: string): Promise<number>;
  zrangebyscore(key: string, min: number | '-inf', max: number | '+inf'): Promise<string[]>;
  zrem(key: string, member: string): Promise<number>;
  sadd(key: string, member: string): Promise<number>;
  smembers(key: string): Promise<string[]>;
  srem(key: string, member: string): Promise<number>;
}
```

### Custom Connector — MongoDB, DynamoDB, ORMs

For databases not covered by `SqlAdapter` or `RedisAdapter`, implement `SagaStore` directly. The interface has four methods and no framework coupling.

**Example: MongoDB**

```typescript
import type { SagaStore, SagaState, SagaFilter, SagaId, SagaResult } from '@backendkit-labs/saga';
import { ok, fail } from '@backendkit-labs/result';

export class MongoAdapter implements SagaStore {
  constructor(private readonly collection: MongoCollection) {}

  async save(state: SagaState): Promise<SagaResult<void>> {
    try {
      const existing = await this.collection.findOne({ _id: state.id });

      if (!existing) {
        await this.collection.insertOne({ _id: state.id, ...state });
      } else {
        const result = await this.collection.updateOne(
          { _id: state.id, version: state.version - 1 },
          { $set: state },
        );
        if (result.matchedCount === 0) {
          return fail({ category: 'PERSISTENCE_ERROR', cause: new Error('Version conflict') });
        }
      }
      return ok(undefined);
    } catch (err) {
      return fail({ category: 'PERSISTENCE_ERROR', cause: err as Error });
    }
  }

  async load(sagaId: SagaId): Promise<SagaResult<SagaState>> {
    const doc = await this.collection.findOne({ _id: sagaId });
    if (!doc) return fail({ category: 'SAGA_NOT_FOUND', sagaId });
    return ok(doc as SagaState);
  }

  async list(filter?: SagaFilter): Promise<SagaResult<SagaState[]>> {
    const query: Record<string, unknown> = {};
    if (filter?.status)   query['status']   = filter.status;
    if (filter?.sagaType) query['sagaType'] = filter.sagaType;

    const docs = await this.collection
      .find(query)
      .sort({ createdAt: -1 })
      .skip(filter?.offset ?? 0)
      .limit(filter?.limit ?? 100)
      .toArray();

    return ok(docs as SagaState[]);
  }

  async delete(sagaId: SagaId): Promise<SagaResult<void>> {
    await this.collection.deleteOne({ _id: sagaId });
    return ok(undefined);
  }
}
```

Other connectors you can build following the same pattern:

| Connector | Key consideration |
|-----------|------------------|
| **DynamoDB** | Use `version` in a `ConditionExpression` for optimistic locking |
| **Prisma** | Wrap the generated Prisma Client; map the `saga_states` model |
| **Drizzle ORM** | Define the schema with Drizzle types, implement the four methods |
| **TypeORM** | Create a `SagaStateEntity`, inject the `Repository` |

---

## Locking

The `LockProvider` interface prevents concurrent execution of the same saga instance.

```typescript
export interface LockProvider {
  acquire(lockKey: string, ttlMs: number): Promise<SagaResult<boolean>>;
  release(lockKey: string): Promise<SagaResult<void>>;
  isLocked(lockKey: string): Promise<SagaResult<boolean>>;
}
```

### InMemoryLock

For single-process use. TTL-based expiry handled in memory. No dependencies.

```typescript
import { InMemoryLock } from '@backendkit-labs/saga';

const lock = new InMemoryLock();
```

> Locks do not survive process restarts. Use `RedisLockAdapter` in any multi-instance deployment.

### RedisLockAdapter

Distributed lock using Redis `SET key value NX PX ttl` (atomic test-and-set).

```typescript
import { RedisLockAdapter } from '@backendkit-labs/saga/locks/redis';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);
const lock = new RedisLockAdapter(redis, {
  keyPrefix: 'saga:lock', // optional, default: 'saga:lock'
});
```

Duck-typed `RedisLockClient` — any compatible client works:

```typescript
export interface RedisLockClient {
  set(key: string, value: string, mode: 'NX', duration: 'PX', ttl: number): Promise<'OK' | null>;
  get(key: string): Promise<string | null>;
  del(key: string): Promise<number>;
}
```

### Custom Lock

Implement `LockProvider` for any backing system — database advisory locks, ZooKeeper, etcd, etc.

**Example: PostgreSQL advisory lock**

```typescript
import type { LockProvider, SagaResult } from '@backendkit-labs/saga';
import { ok } from '@backendkit-labs/result';

export class PostgresAdvisoryLock implements LockProvider {
  constructor(private readonly pool: SqlClient) {}

  async acquire(lockKey: string, _ttlMs: number): Promise<SagaResult<boolean>> {
    const { rows } = await this.pool.query(
      'SELECT pg_try_advisory_lock(hashtext($1)) AS acquired',
      [lockKey],
    );
    return ok(rows[0].acquired as boolean);
  }

  async release(lockKey: string): Promise<SagaResult<void>> {
    await this.pool.query('SELECT pg_advisory_unlock(hashtext($1))', [lockKey]);
    return ok(undefined);
  }

  async isLocked(lockKey: string): Promise<SagaResult<boolean>> {
    const { rows } = await this.pool.query(
      `SELECT COUNT(*) > 0 AS locked FROM pg_locks
        WHERE locktype = 'advisory' AND classid = hashtext($1)::int`,
      [lockKey],
    );
    return ok(rows[0].locked as boolean);
  }
}
```

---

## Events

Subscribe to lifecycle events emitted by the engine.

```typescript
import { SagaEventBusImpl } from '@backendkit-labs/saga';

const eventBus = new SagaEventBusImpl();

eventBus.subscribe('SAGA_COMPLETED', async (event) => {
  console.log('Completed:', event.sagaId, event.payload);
});

eventBus.subscribe('STEP_FAILED', async (event) => {
  alerting.notify(event.payload);
});
```

Available event types: `SAGA_STARTED`, `SAGA_COMPLETED`, `SAGA_FAILED`, `STEP_STARTED`, `STEP_SUCCEEDED`, `STEP_FAILED`, `COMPENSATION_STARTED`, `COMPENSATION_COMPLETED`.

---

## Error Handling

All operations return `SagaResult<T>` = `Result<T, SagaError>` from `@backendkit-labs/result`. Nothing throws.

```typescript
import { isOk, isFail } from '@backendkit-labs/result';
import {
  isBusinessError,
  isRetryExhausted,
  isPersistenceError,
} from '@backendkit-labs/saga';

const result = await engine.run('order-saga', input);

if (isFail(result)) {
  const err = result.error;

  if (isBusinessError(err)) {
    // Domain / validation error — compensation already ran
    console.error('Business error in step', err.step, '—', err.code);
  } else if (isRetryExhausted(err)) {
    // All retry attempts failed — compensation already ran
    console.error('Step', err.step, 'exhausted', err.attempts, 'attempts');
  } else if (isPersistenceError(err)) {
    // Store failure
    console.error('DB error:', err.cause.message);
  }
}
```

### Error type classification

| Type | Retried? | When triggered |
|------|----------|----------------|
| `BUSINESS_ERROR` | No | Validation failures, domain rules |
| `INFRASTRUCTURE_ERROR` | Yes (if in `retryOn`) | Network issues, 5xx errors |
| `STEP_TIMEOUT` | Yes (if in `retryOn`) | Step exceeded `timeoutMs` |

### Error factory helpers

```typescript
import { businessError, infrastructureError, stepTimeout } from '@backendkit-labs/saga';

return fail(businessError('validate', 'INVALID_EMAIL', new Error('...')));
return fail(infrastructureError('call-api', 'HTTP_503', new Error('...')));
return fail(stepTimeout('send-email', 5000));
```

---

## Recovery Engine

Automatically resumes sagas left in an in-progress state after a crash. Only picks up sagas whose distributed lock has expired.

```typescript
import { RecoveryEngine, SagaScanner } from '@backendkit-labs/saga';

// Run once on startup
const recovery = new RecoveryEngine(store, engine);
const result = await recovery.recoverCrashedSagas();
if (isOk(result)) {
  console.log(`Recovered ${result.value} crashed sagas`);
}

// Or run continuously in the background
const scanner = new SagaScanner(store, engine, { intervalMs: 30_000 });
scanner.start();
// On shutdown:
scanner.stop();
```

---

## NestJS Integration

### Module Setup

```typescript
import { Module } from '@nestjs/common';
import { SagaModule, InMemoryStore, InMemoryLock, SagaEventBusImpl } from '@backendkit-labs/saga';

@Module({
  imports: [
    SagaModule.forRoot({
      stores: {
        sagaStore: new InMemoryStore(),
        lockProvider: new InMemoryLock(),
        eventBus: new SagaEventBusImpl(),
      },
      defaults: {
        retryPolicy: {
          maxAttempts: 3,
          initialBackoffMs: 1000,
          backoffMultiplier: 2,
          maxBackoffMs: 30_000,
          jitter: true,
          retryOn: ['INFRASTRUCTURE_ERROR', 'STEP_TIMEOUT'],
        },
      },
    }),
  ],
})
export class AppModule {}
```

With PostgreSQL + Redis:

```typescript
import { SqlAdapter }       from '@backendkit-labs/saga/stores/sql';
import { RedisAdapter }     from '@backendkit-labs/saga/stores/redis';
import { RedisLockAdapter } from '@backendkit-labs/saga/locks/redis';
import { Pool } from 'pg';
import Redis from 'ioredis';

const pg    = new Pool({ connectionString: process.env.DATABASE_URL });
const redis = new Redis(process.env.REDIS_URL);

SagaModule.forRoot({
  stores: {
    sagaStore: new SqlAdapter(
      { query: async (sql, params) => {
          const r = await pg.query(sql, params);
          return { rows: r.rows, affectedRows: r.rowCount ?? 0 };
        },
      },
      { dialect: 'postgres' },
    ),
    lockProvider: new RedisLockAdapter(redis),
    eventBus: new SagaEventBusImpl(),
  },
});
```

In feature modules:

```typescript
@Module({
  imports: [SagaModule.forFeature()],
  providers: [OrderSagaHandler],
})
export class OrdersModule {}
```

### Decorator-based Sagas

```typescript
import { Injectable } from '@nestjs/common';
import {
  Saga, Step, Compensate,
  StepContext as StepCtx,
  SagaEventHandler,
} from '@backendkit-labs/saga';
import type { StepContext, CompensationContext, SagaEvent } from '@backendkit-labs/saga';
import { ok } from '@backendkit-labs/result';

@Saga({ name: 'order-flow' })
@Injectable()
export class OrderSagaHandler {

  @Step({ name: 'reserve-inventory', timeout: 5000 })
  async reserveInventory(@StepCtx() ctx: StepContext) {
    const reserved = await this.inventory.reserve(ctx.input);
    return ok(reserved);
  }

  @Compensate('reserve-inventory')
  async releaseInventory(@StepCtx() ctx: CompensationContext) {
    await this.inventory.release(ctx.originalOutput);
    return ok(undefined);
  }

  @Step({ name: 'charge-payment', retry: { maxAttempts: 3, retryOn: ['INFRASTRUCTURE_ERROR'] } })
  async chargePayment(@StepCtx() ctx: StepContext) {
    const charge = await this.payments.charge(ctx.previousOutput);
    return ok(charge);
  }

  @Compensate('charge-payment')
  async refundPayment(@StepCtx() ctx: CompensationContext) {
    await this.payments.refund(ctx.originalOutput);
    return ok(undefined);
  }

  @SagaEventHandler('SAGA_COMPLETED')
  onCompleted(event: SagaEvent) {
    this.analytics.track('order-completed', event.sagaId);
  }
}
```

### SagaOrchestrator Service

```typescript
import { Injectable } from '@nestjs/common';
import { SagaOrchestrator } from '@backendkit-labs/saga';
import { isOk } from '@backendkit-labs/result';

@Injectable()
export class OrderService {
  constructor(private readonly saga: SagaOrchestrator) {}

  async placeOrder(dto: CreateOrderDto) {
    const result = await this.saga.run('order-flow', dto);
    if (!isOk(result)) throw new Error(JSON.stringify(result.error));
    return result.value;
  }

  async pauseOrder(sagaId: string) {
    return this.saga.pause(sagaId as SagaId);
  }

  async getStatus(sagaId: string) {
    return this.saga.getStatus(sagaId as SagaId);
  }
}
```

`SagaCorrelationIdInterceptor` is registered automatically and propagates `x-correlation-id` HTTP headers into the saga correlation context.

---

## Integration Adapters

Optional adapters for resilience and observability. All are opt-in.

### Circuit Breaker

```typescript
import { SagaCircuitBreaker } from '@backendkit-labs/saga';

const breaker = new SagaCircuitBreaker({ failureThreshold: 5, successThreshold: 2, timeout: 30_000 });

const step = {
  name: 'call-payment-api',
  execute: (ctx) => breaker.execute(() => paymentApi.charge(ctx.input)),
};
```

### Bulkhead (Concurrency Limit)

```typescript
import { SagaBulkhead } from '@backendkit-labs/saga';

const bulkhead = new SagaBulkhead({ maxConcurrent: 10, maxQueue: 50 });

const step = {
  name: 'process-item',
  execute: (ctx) => bulkhead.execute(() => processor.run(ctx.input)),
};
```

### Observability

```typescript
import { SagaObservability, ConsoleSagaLogger, NoopSagaMetrics } from '@backendkit-labs/saga';

const observability = new SagaObservability({
  logger: new ConsoleSagaLogger(),
  metrics: new NoopSagaMetrics(),
});
```

### Pipeline Middleware

```typescript
import { SagaPipeline, loggingMiddleware, timeoutMiddleware, retryMiddleware } from '@backendkit-labs/saga';

const pipeline = new SagaPipeline([
  loggingMiddleware,
  timeoutMiddleware(5000),
  retryMiddleware({ maxAttempts: 3 }),
]);

const step = {
  name: 'enriched-step',
  execute: (ctx) => pipeline.run(ctx, actualHandler),
};
```

---

## CLI Tool

Inspect and manage sagas from the terminal. Requires a running PostgreSQL instance.

```bash
export SAGA_PG_URL="postgresql://user:pass@localhost:5432/mydb"

# List the last 20 sagas
npx saga-cli list

# Filter by status or type
npx saga-cli list --status FAILED
npx saga-cli list --type order-saga --limit 50 --offset 0

# Inspect a specific saga (full state + step timeline)
npx saga-cli inspect <sagaId>

# Pause / Resume
npx saga-cli pause  <sagaId>
npx saga-cli resume <sagaId>
```

Example `inspect` output:

```
── Saga State ─────────────────────────────
  ID:            a1b2c3d4-...
  Type:          order-saga
  Status:        FAILED
  CorrelationId: corr-xyz
  Version:       4
  Created:       2024-01-15T10:23:00.000Z
  Updated:       2024-01-15T10:23:45.000Z

── Steps ───────────────────────────────────
    [1] reserve-inventory              SUCCEEDED (attempt 1)
  → [2] charge-payment                 FAILED    (attempt 3)
        Error: {"type":"INFRASTRUCTURE_ERROR","code":"HTTP_503"}
    [3] send-confirmation              PENDING   (attempt 0)
```

---

## Status Reference

### Saga Status (9 states)

| Status | Description |
|--------|-------------|
| `PENDING` | Created, not yet started |
| `RUNNING` | Execution in progress |
| `STEP_EXECUTING` | A specific step is actively running |
| `PAUSED` | Manually paused — awaiting resume |
| `COMPLETED` | All steps succeeded |
| `COMPENSATING` | A step failed — compensating previous steps |
| `COMPENSATION_DONE` | All compensations completed |
| `PARTIALLY_COMPENSATED` | Some compensations also failed |
| `FAILED` | Terminal failure after full or partial compensation |

### Step Status (6 states)

| Status | Description |
|--------|-------------|
| `PENDING` | Not yet started |
| `EXECUTING` | Currently running |
| `SUCCEEDED` | Completed successfully |
| `FAILED` | Failed (may have triggered saga compensation) |
| `COMPENSATED` | Rollback ran successfully |
| `COMPENSATION_FAILED` | Rollback itself failed |

### Lifecycle diagram

```
PENDING → RUNNING → STEP_EXECUTING → RUNNING → ... → COMPLETED
                         ↓ (failure)
                    COMPENSATING → COMPENSATION_DONE → FAILED
                                 → PARTIALLY_COMPENSATED → FAILED
          RUNNING → PAUSED → RUNNING (on resume)
```

---

## License

Apache-2.0 © [BackendKit Labs](https://backendkitlabs.dev)
