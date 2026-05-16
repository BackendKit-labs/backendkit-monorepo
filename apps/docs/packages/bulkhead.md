---
title: Bulkhead
description: Concurrency limiting for Node.js — isolate failures and protect shared resources from overload.
---

# @backendkit-labs/bulkhead

[![npm](https://img.shields.io/npm/v/@backendkit-labs/bulkhead?style=flat-square&color=cb3837)](https://www.npmjs.com/package/@backendkit-labs/bulkhead)
[![License](https://img.shields.io/npm/l/@backendkit-labs/bulkhead?style=flat-square)](https://github.com/BackendKit-labs/backendkit-monorepo/blob/master/LICENSE)
[![Node](https://img.shields.io/node/v/@backendkit-labs/bulkhead?style=flat-square)](https://nodejs.org)

> Bulkhead concurrency limiting for Node.js — inspired by Resilience4j. Framework-agnostic core with optional NestJS integration.

Prevents resource exhaustion and cascading failures by limiting how many operations run simultaneously on a given resource.

## Installation

```bash
npm install @backendkit-labs/bulkhead
```

## Quick Start

```typescript
import { Bulkhead } from '@backendkit-labs/bulkhead';

const bulkhead = new Bulkhead({
  name:               'payments',
  maxConcurrentCalls: 10,
  maxQueueSize:       50,
  queueTimeoutMs:     5000,
  rejectWhenFull:     true,
});

const result = await bulkhead.execute(() => callPaymentApi());
```

## Core API

### `Bulkhead`

```typescript
const bulkhead = new Bulkhead(config);

await bulkhead.execute(async () => { ... }); // waits in queue if at capacity
bulkhead.canAccept();                         // boolean — capacity available?
bulkhead.getMetrics();                        // current metrics snapshot
bulkhead.resetMetrics();                      // reset all counters
```

### `BulkheadConfig`

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | Identifier for metrics and error messages |
| `maxConcurrentCalls` | `number` | Max simultaneous executions |
| `maxQueueSize` | `number` | Max tasks waiting in queue |
| `queueTimeoutMs` | `number` | Max time a task can wait in queue (ms) |
| `rejectWhenFull` | `boolean` | Throw immediately when full; if `false`, retries with exponential backoff |

### Metrics

```typescript
const m = bulkhead.getMetrics();
// {
//   name:               'payments',
//   activeCalls:        3,
//   queuedCalls:        7,
//   maxConcurrentCalls: 10,
//   totalCalls:         512,
//   successfulCalls:    498,
//   failedCalls:        5,
//   rejectedCalls:      9,
//   timedOutCalls:      0,
//   averageDurationMs:  42,
// }
```

### Errors

```typescript
import { BulkheadRejectedError, BulkheadTimeoutError } from '@backendkit-labs/bulkhead';

try {
  await bulkhead.execute(task);
} catch (error) {
  if (error instanceof BulkheadRejectedError) { /* queue was full */ }
  if (error instanceof BulkheadTimeoutError)  { /* waited too long */ }
}
```

## BulkheadRegistry

Manages named instances with sensible defaults for common resource types:

```typescript
const registry = new BulkheadRegistry();

// Custom
const bh = registry.getOrCreate({ name: 'my-service', maxConcurrentCalls: 15 });

// Pre-configured factory methods
const clientBh   = registry.getForClient('client-123', '/api/orders'); // 5 concurrent, 20 queued
const serviceBh  = registry.getForService('inventory-service');         // 20 concurrent, 200 queued
const dbBh       = registry.getForDatabase('orders_schema');            // 15 concurrent, 150 queued
const externalBh = registry.getForHttpExternal('stripe-api');           // 8 concurrent, 50 queued
```

| Method | Concurrent | Queue | Timeout |
|--------|-----------|-------|---------|
| `getForClient(id, endpoint?)` | 5 | 20 | 30s |
| `getForService(name)` | 20 | 200 | 30s |
| `getForDatabase(schema)` | 15 | 150 | 30s |
| `getForHttpExternal(name)` | 8 | 50 | 10s |

```typescript
registry.getAllMetrics();                   // Record<string, BulkheadMetrics>
registry.getOverloadedBulkheads();         // ≥80% active capacity
registry.resetAllMetrics();
```

## NestJS Integration

```typescript
import { BulkheadModule } from '@backendkit-labs/bulkhead/nestjs';

@Module({ imports: [BulkheadModule] })
export class AppModule {}
```

### Guard — declarative per-route protection

```typescript
@Controller('orders')
export class OrdersController {
  @UseBulkhead({ name: 'orders-service' })
  @UseGuards(BulkheadGuard)
  @Get()
  findAll() { ... }

  // Per-client isolation — reads x-client-id header
  @UseBulkhead({ name: 'orders-create', perClient: true })
  @UseGuards(BulkheadGuard)
  @Post()
  create() { ... }
}
```

Returns `503 Service Unavailable` when at capacity.

### Interceptor

```typescript
app.useGlobalInterceptors(new BulkheadInterceptor(registry));
```

Returns `503` on rejection, `408` on timeout.

### Middleware — global HTTP concurrency limit

Protects the entire service before requests even reach your handlers:

```typescript
@Module({ imports: [BulkheadModule] })
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(HttpBulkheadMiddleware).forRoutes('*');
  }
}
```

| Env variable | Default | Description |
|---|---|---|
| `HTTP_BULKHEAD_CONCURRENCY` | `50` | Max concurrent requests |
| `HTTP_BULKHEAD_MAX_QUEUE` | `100` | Max queued requests |

Returns `429 Too Many Requests` when the queue is full.

### Method Decorator

```typescript
@Injectable()
export class ReportService {
  constructor(public readonly bulkheadRegistry: BulkheadRegistry) {}

  @WithBulkhead({ name: 'report-generation', maxConcurrent: 3 })
  async generateReport(id: string) { ... }
}
```

### Monitoring — BulkheadService

```typescript
@Controller('health')
export class HealthController {
  constructor(private readonly bulkheads: BulkheadService) {}

  @Get('bulkheads')
  getMetrics() {
    return {
      all:      this.bulkheads.getAllMetrics(),
      critical: this.bulkheads.getCriticalBulkheads(), // ≥90% active
    };
  }
}
```

Logs a warning every 60 seconds when any bulkhead reaches 90%+ utilization.

## Architecture

```
@backendkit-labs/bulkhead         (core — no framework deps)
  Bulkhead                        queue-based concurrency limiter
  BulkheadRegistry                named instances + factory methods

@backendkit-labs/bulkhead/nestjs  (optional NestJS layer)
  BulkheadModule                  NestJS module
  BulkheadGuard                   @UseBulkhead() per-route decorator
  BulkheadInterceptor             wraps handler in execute()
  HttpBulkheadMiddleware          global HTTP request limiter
  WithBulkhead                    method-level decorator
  BulkheadService                 metrics + auto-monitoring
```
