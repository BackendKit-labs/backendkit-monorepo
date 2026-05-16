# @backendkit-labs/bulkhead

[![npm version](https://img.shields.io/npm/v/@backendkit-labs/bulkhead?style=flat-square&color=cb3837)](https://www.npmjs.com/package/@backendkit-labs/bulkhead)
[![CI](https://img.shields.io/github/actions/workflow/status/BackendKit-labs/backendkit-monorepo/ci.yml?style=flat-square&label=CI)](https://github.com/BackendKit-labs/backendkit-monorepo/actions/workflows/ci.yml)
[![License](https://img.shields.io/npm/l/@backendkit-labs/bulkhead?style=flat-square)](LICENSE)
[![Node](https://img.shields.io/node/v/@backendkit-labs/bulkhead?style=flat-square)](package.json)
[![Docs](https://img.shields.io/badge/docs-backendkitlabs.dev-4f7eff?style=flat-square)](https://backendkitlabs.dev/docs/bulkhead/)

> Bulkhead concurrency limiting for Node.js — inspired by Resilience4j. Framework-agnostic core with optional NestJS integration.

Prevents resource exhaustion and cascading failures by limiting how many operations run simultaneously on a given resource.

---

## Installation

```bash
npm install @backendkit-labs/bulkhead
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
      "@backendkit-labs/bulkhead/nestjs": [
        "./node_modules/@backendkit-labs/bulkhead/dist/nestjs/index"
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

## Quick Start — Framework-agnostic

```typescript
import { Bulkhead } from '@backendkit-labs/bulkhead';

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
import { BulkheadRejectedError, BulkheadTimeoutError } from '@backendkit-labs/bulkhead';

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
import { BulkheadRegistry } from '@backendkit-labs/bulkhead';

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
npm install @backendkit-labs/bulkhead
```

Import `BulkheadModule` into your NestJS application:

```typescript
import { BulkheadModule } from '@backendkit-labs/bulkhead/nestjs';

@Module({
  imports: [BulkheadModule],
})
export class AppModule {}
```

### Guard — declarative per-route protection

```typescript
import { UseBulkhead, BulkheadGuard } from '@backendkit-labs/bulkhead/nestjs';

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
import { BulkheadInterceptor } from '@backendkit-labs/bulkhead/nestjs';

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
import { HttpBulkheadMiddleware } from '@backendkit-labs/bulkhead/nestjs';

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
import { WithBulkhead } from '@backendkit-labs/bulkhead/nestjs';

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
import { BulkheadService } from '@backendkit-labs/bulkhead/nestjs';

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

---

## License

Apache-2.0 — [BackendKit Labs](https://github.com/BackendKit-labs)
