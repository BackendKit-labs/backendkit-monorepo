# @backendkit-labs/resilience

[![npm version](https://img.shields.io/npm/v/@backendkit-labs/resilience?style=flat-square&color=cb3837)](https://www.npmjs.com/package/@backendkit-labs/resilience)
[![CI](https://img.shields.io/github/actions/workflow/status/backendkit-dev/backendkit-monorepo/ci.yml?style=flat-square&label=CI)](https://github.com/backendkit-dev/backendkit-monorepo/actions/workflows/ci.yml)
[![License](https://img.shields.io/npm/l/@backendkit-labs/resilience?style=flat-square)](LICENSE)
[![Node](https://img.shields.io/node/v/@backendkit-labs/resilience?style=flat-square)](package.json)

> Bulkhead concurrency limiting for Node.js — inspired by Resilience4j. Framework-agnostic core with optional NestJS integration.

Prevents resource exhaustion and cascading failures by limiting how many operations run simultaneously on a given resource.

---

## Installation

```bash
npm install @backendkit-labs/resilience
```

---

## Quick Start — Framework-agnostic

```typescript
import { Bulkhead } from '@backendkit-labs/resilience';

const bulkhead = new Bulkhead({
  name: 'payments',
  maxConcurrentCalls: 10,
  maxQueueSize: 50,
  queueTimeoutMs: 5000,
  rejectWhenFull: true,
});

const result = await bulkhead.execute(() => callPaymentApi());
```

---

## Core API

### `Bulkhead`

```typescript
const bulkhead = new Bulkhead(config);

// Execute a task — waits in queue if at capacity
await bulkhead.execute(async () => { ... });

// Check if capacity is available before executing
if (bulkhead.canAccept()) { ... }

// Current metrics snapshot
const metrics = bulkhead.getMetrics();

// Reset all counters
bulkhead.resetMetrics();
```

### `BulkheadConfig`

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | Identifier for metrics and error messages |
| `maxConcurrentCalls` | `number` | Max simultaneous executions |
| `maxQueueSize` | `number` | Max tasks waiting in queue |
| `queueTimeoutMs` | `number` | Max time a task can wait in queue (ms) |
| `rejectWhenFull` | `boolean` | Throw immediately when full; if `false`, retries with exponential backoff |

### `BulkheadMetrics`

```typescript
{
  name: string;
  activeCalls: number;
  queuedCalls: number;
  maxConcurrentCalls: number;
  maxQueueSize: number;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  rejectedCalls: number;
  timedOutCalls: number;
  averageDurationMs: number;
}
```

### Errors

```typescript
import { BulkheadRejectedError, BulkheadTimeoutError } from '@backendkit-labs/resilience';

try {
  await bulkhead.execute(task);
} catch (error) {
  if (error instanceof BulkheadRejectedError) {
    // Queue was full — task was not queued
  }
  if (error instanceof BulkheadTimeoutError) {
    // Task waited too long in queue
  }
}
```

---

## BulkheadRegistry

Manages named bulkhead instances with sensible defaults for common resource types:

```typescript
import { BulkheadRegistry } from '@backendkit-labs/resilience';

const registry = new BulkheadRegistry();

// Custom
const bh = registry.getOrCreate({ name: 'my-service', maxConcurrentCalls: 15 });

// Pre-configured factory methods
const clientBh   = registry.getForClient('client-123', '/api/orders');   // 5 concurrent, 20 queued
const serviceBh  = registry.getForService('inventory-service');           // 20 concurrent, 200 queued
const dbBh       = registry.getForDatabase('orders_schema');              // 15 concurrent, 150 queued
const externalBh = registry.getForHttpExternal('stripe-api');             // 8 concurrent, 50 queued, 10s timeout

// Observability
const all        = registry.getAllMetrics();
const overloaded = registry.getOverloadedBulkheads(); // ≥80% active capacity
registry.resetAllMetrics();
```

| Method | Concurrent | Queue | Timeout |
|--------|-----------|-------|---------|
| `getForClient(id, endpoint?)` | 5 | 20 | 30s |
| `getForService(name)` | 20 | 200 | 30s |
| `getForDatabase(schema)` | 15 | 150 | 30s |
| `getForHttpExternal(name)` | 8 | 50 | 10s |

---

## NestJS Integration

```bash
npm install @backendkit-labs/resilience
```

Import `BulkheadModule` into your NestJS application:

```typescript
import { BulkheadModule } from '@backendkit-labs/resilience/nestjs';

@Module({
  imports: [BulkheadModule],
})
export class AppModule {}
```

### Guard — declarative per-route protection

```typescript
import { UseBulkhead, BulkheadGuard } from '@backendkit-labs/resilience/nestjs';

@Controller('orders')
export class OrdersController {
  // Shared service-level limit
  @UseBulkhead({ name: 'orders-service' })
  @UseGuards(BulkheadGuard)
  @Get()
  findAll() { ... }

  // Per-client isolation (reads x-client-id header)
  @UseBulkhead({ name: 'orders-create', perClient: true })
  @UseGuards(BulkheadGuard)
  @Post()
  create() { ... }
}
```

Returns `503 Service Unavailable` when at capacity.

### Interceptor — wraps handler execution inside the bulkhead

```typescript
import { BulkheadInterceptor } from '@backendkit-labs/resilience/nestjs';

// Apply globally
app.useGlobalInterceptors(new BulkheadInterceptor(registry));

// Or per controller / route
@UseInterceptors(BulkheadInterceptor)
@Controller('reports')
export class ReportsController { ... }
```

Returns `503` on rejection, `408` on timeout.

### Middleware — global HTTP concurrency limit

Protects the entire service from being overwhelmed before requests even reach your handlers:

```typescript
import { HttpBulkheadMiddleware } from '@backendkit-labs/resilience/nestjs';

@Module({ imports: [BulkheadModule] })
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(HttpBulkheadMiddleware).forRoutes('*');
  }
}
```

Configure via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `HTTP_BULKHEAD_CONCURRENCY` | `50` | Max concurrent requests |
| `HTTP_BULKHEAD_MAX_QUEUE` | `100` | Max queued requests |

Returns `429 Too Many Requests` when the queue is full.

### Method Decorator

```typescript
import { WithBulkhead } from '@backendkit-labs/resilience/nestjs';

@Injectable()
export class ReportService {
  // Must have bulkheadRegistry injected
  constructor(public readonly bulkheadRegistry: BulkheadRegistry) {}

  @WithBulkhead({ name: 'report-generation', maxConcurrent: 3 })
  async generateReport(id: string) { ... }
}
```

### Monitoring — BulkheadService

```typescript
import { BulkheadService } from '@backendkit-labs/resilience/nestjs';

@Controller('health')
export class HealthController {
  constructor(private readonly bulkheads: BulkheadService) {}

  @Get('bulkheads')
  getMetrics() {
    return {
      all: this.bulkheads.getAllMetrics(),
      critical: this.bulkheads.getCriticalBulkheads(), // ≥90% active
    };
  }
}
```

`BulkheadService` also logs a warning every 60 seconds when any bulkhead reaches 90%+ utilization.

---

## Architecture

```
@backendkit-labs/resilience        (core — no framework deps)
  Bulkhead                         queue-based concurrency limiter
  BulkheadRegistry                 named instances + factory methods

@backendkit-labs/resilience/nestjs (optional NestJS layer)
  BulkheadModule                   NestJS module
  BulkheadGuard                    @UseBulkhead() per-route decorator
  BulkheadInterceptor              wraps handler in execute()
  HttpBulkheadMiddleware           global HTTP request limiter
  WithBulkhead                     method-level decorator
  BulkheadService                  metrics + auto-monitoring
```

---

## License

MIT — [BackendKit Labs](https://github.com/backendkit-dev)
