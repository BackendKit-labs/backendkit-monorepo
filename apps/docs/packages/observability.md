---
title: Observability
description: Structured logging, metrics, correlation ID propagation, and optional OpenTelemetry support for NestJS.
---

# @backendkit-labs/observability

[![npm](https://img.shields.io/npm/v/@backendkit-labs/observability?style=flat-square&color=cb3837)](https://www.npmjs.com/package/@backendkit-labs/observability)
[![License](https://img.shields.io/npm/l/@backendkit-labs/observability?style=flat-square)](https://github.com/BackendKit-labs/backendkit-monorepo/blob/master/LICENSE)
[![Node](https://img.shields.io/node/v/@backendkit-labs/observability?style=flat-square)](https://nodejs.org)

Structured logging, distributed tracing correlation, metrics shipping, performance interceptors, and exception handling for **NestJS** — with optional OpenTelemetry integration.

| Feature | Description |
|---|---|
| **CorrelationIdService** | AsyncLocalStorage-based correlation ID propagation across the full async call stack |
| **LoggerService** | Winston-backed structured logger with optional batched HTTP transport |
| **MetricsService** | Fire-and-forget metric event shipping with buffering and circuit breaker |
| **CorrelationInterceptor** | Reads/generates `x-correlation-id` and sets it on the response header |
| **PerformanceInterceptor** | Logs and records HTTP request duration for every route |
| **AllExceptionsFilter** | Unified error response shape with pluggable error mappers |
| **@TrackPerformance** | Method decorator that wraps any async method in an OTel span |
| **OTel optional** | `@opentelemetry/api` is a peer — drop it and everything becomes a no-op |

## Installation

```bash
npm install @backendkit-labs/observability

# optional — only if you use OTel tracing
npm install @opentelemetry/api
```

## Quick Start

```typescript
// app.module.ts
import { ObservabilityModule } from '@backendkit-labs/observability';

@Module({
  imports: [
    ObservabilityModule.forRoot({
      serviceName: 'my-api',
      environment: 'production',
      logLevel:    'info',

      http: {
        url:       'https://logs.example.com/ingest',
        authToken: process.env.OBS_AUTH_TOKEN,
      },
      metrics: {
        url:       'https://metrics.example.com/ingest',
        authToken: process.env.OBS_AUTH_TOKEN,
      },
    }),
  ],
})
export class AppModule {}
```

Register interceptors and the exception filter globally in `main.ts`:

```typescript
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalInterceptors(
    app.get(CorrelationInterceptor),
    app.get(PerformanceInterceptor),
  );

  app.useGlobalFilters(app.get(AllExceptionsFilter));
  app.useLogger(app.get(LoggerService));

  await app.listen(3000);
}
```

## Module Options

```typescript
interface ObservabilityOptions {
  serviceName:  string;
  environment?: string;   // default: "production"
  logLevel?:    'error' | 'warn' | 'info' | 'http' | 'verbose' | 'debug' | 'silly';
  http?:        HttpTransportOptions;
  metrics?:     MetricsOptions;
}
```

### HTTP log transport options

```typescript
interface HttpTransportOptions {
  url:              string;
  authToken?:       string;
  headers?:         Record<string, string>;
  batchSize?:       number;   // default 100
  maxBufferSize?:   number;   // default 2000
  flushIntervalMs?: number;   // default 5000
  timeoutMs?:       number;   // default 5000
  circuitBreaker?:  Partial<CircuitBreakerConfig>;
}
```

### Metrics transport options

```typescript
interface MetricsOptions {
  url:              string;
  authToken?:       string;
  headers?:         Record<string, string>;
  flushIntervalMs?: number;   // default 10000
  maxBufferSize?:   number;   // default 5000
  timeoutMs?:       number;   // default 5000
  circuitBreaker?:  Partial<CircuitBreakerConfig>;
}
```

## CorrelationIdService

Propagates a request-scoped correlation ID through every `await` using `AsyncLocalStorage`.

```typescript
@Injectable()
export class OrdersService {
  constructor(private readonly correlation: CorrelationIdService) {}

  async processOrder(id: string) {
    const cid      = this.correlation.get();            // always returns a string
    const maybeId  = this.correlation.getOrUndefined(); // undefined outside a context

    // OTel trace/span IDs (undefined when OTel not installed)
    const trace    = this.correlation.getTraceContext();
    // => { traceId: 'abc…', spanId: '123…' } | undefined
  }
}
```

`CorrelationInterceptor` automatically seeds the context from the incoming `x-correlation-id` header (or generates a fresh UUID) and echoes the ID back in the response header.

## LoggerService

Drop-in replacement for NestJS's built-in logger. All entries include `service`, `environment`, and `correlationId` automatically.

```typescript
@Injectable()
export class PaymentsService {
  constructor(private readonly logger: LoggerService) {}

  async charge(amount: number) {
    this.logger.log('Charging card', PaymentsService.name);
    this.logger.warn('High amount', PaymentsService.name);
    this.logger.error('Card declined', undefined, PaymentsService.name);

    // Arbitrary extra fields
    this.logger.logWithMeta('info', 'Payment processed', {
      amount, currency: 'USD', userId: 'u_123',
    });
  }
}
```

Console output format:

```
2024-01-15T10:30:00.000Z [info] Charging card {"service":"payments","correlationId":"a1b2…"}
```

When `http` is configured, entries are buffered and flushed in batches. A built-in circuit breaker pauses sends after repeated failures so logging never blocks your application.

## MetricsService

```typescript
@Injectable()
export class CheckoutService {
  constructor(private readonly metrics: MetricsService) {}

  async checkout(cart: Cart) {
    const start = Date.now();
    // ... process ...
    this.metrics.record('checkout.duration', Date.now() - start, {
      unit: 'ms',
      tags: { region: 'us-east-1' },
    });

    this.metrics.record('checkout.items', cart.items.length, {
      tags: { currency: cart.currency },
    });
  }
}
```

Events are buffered and shipped in batches. The service flushes remaining events on `onModuleDestroy` (graceful shutdown).

## AllExceptionsFilter

Returns a consistent error shape for every unhandled exception:

```json
{
  "ok":            false,
  "statusCode":    404,
  "message":       "Resource not found",
  "code":          "NOT_FOUND",
  "correlationId": "a1b2c3d4-...",
  "timestamp":     "2024-01-15T10:30:00.000Z"
}
```

### Custom error mappers

```typescript
const filter = app.get(AllExceptionsFilter);

const domainMapper: ErrorMapper = (err) => {
  if (err instanceof ResourceNotFoundError) {
    return { statusCode: 404, message: err.message, code: 'NOT_FOUND' };
  }
  if (err instanceof ValidationError) {
    return { statusCode: 422, message: err.message, code: 'VALIDATION_ERROR' };
  }
  return null; // fall through to next mapper or default handling
};

filter.addMapper(domainMapper);
app.useGlobalFilters(filter);
```

Multiple mappers are tried in registration order; the first non-`null` result wins.

## @TrackPerformance

Wraps any `async` method in an OpenTelemetry span. When OTel is not installed, it becomes a pure pass-through with zero overhead.

```typescript
@Injectable()
export class ReportsService {
  @TrackPerformance()
  async generateReport(id: string): Promise<Report> {
    // Span name: "ReportsService.generateReport"
    return this.db.buildReport(id);
  }

  @TrackPerformance({
    operation:  'custom-operation-name',
    attributes: { team: 'analytics', critical: true },
  })
  async exportToCsv(id: string): Promise<Buffer> {
    return this.db.export(id);
  }
}
```

## OpenTelemetry Integration

Install `@opentelemetry/api` and configure an SDK separately. This package auto-detects the API and attaches spans.

```bash
npm install @opentelemetry/api @opentelemetry/sdk-node
```

`CorrelationIdService.getTraceContext()` returns the active `traceId` and `spanId` when OTel is active — useful for log correlation.

## Circuit Breaker Behaviour

Both the HTTP log transport and the metrics transport use [`@backendkit-labs/circuit-breaker`](/packages/circuit-breaker) to protect your application from cascading failures in the observability backend.

### Transport defaults

| Option | Default | Description |
|---|---|---|
| `failureThreshold` | `60` | % of calls that must fail to open the circuit |
| `slidingWindowSize` | `5` | Number of calls in the evaluation window |
| `minimumCalls` | `3` | Minimum calls before thresholds are evaluated |
| `openTimeoutMs` | `30 000` | Time to wait in OPEN before transitioning to HALF_OPEN |
| `halfOpenMaxCalls` | `1` | Probe calls allowed in HALF_OPEN |
| `slowCallThreshold` | `100` | % of slow calls to open the circuit (disabled by default) |
| `slowCallDurationMs` | `60 000` | Duration above which a call is considered slow |

### Customising

Pass any subset of `CircuitBreakerConfig` via the `circuitBreaker` option. `name` and `isFailure` are managed internally.

```typescript
import { CircuitBreakerState } from '@backendkit-labs/circuit-breaker';

ObservabilityModule.forRoot({
  serviceName: 'my-api',
  metrics: {
    url: 'https://metrics.example.com/ingest',
    circuitBreaker: {
      failureThreshold:  80,      // open only when 80% of calls fail
      slidingWindowSize: 10,
      minimumCalls:      5,
      openTimeoutMs:     60_000,
      halfOpenMaxCalls:  2,
      onStateChange: (from, to, metrics) => {
        if (to === CircuitBreakerState.OPEN) {
          alerting.trigger(`Metrics CB opened — failure rate ${metrics.failureRate}%`);
        }
      },
    },
  },
});
```

The same `circuitBreaker` option is available on the `http` log transport.
