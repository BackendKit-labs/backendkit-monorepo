# @backendkit-labs/observability

Structured logging, distributed tracing correlation, metrics shipping, performance interceptors, and exception handling for **NestJS** — with optional OpenTelemetry integration.

## Features

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

---

## Installation

```bash
npm install @backendkit-labs/observability

# optional — only if you use OTel tracing
npm install @opentelemetry/api
```

---

## Quick start

```typescript
// app.module.ts
import { Module }              from '@nestjs/common';
import { ObservabilityModule } from '@backendkit-labs/observability';

@Module({
  imports: [
    ObservabilityModule.forRoot({
      serviceName: 'my-api',
      environment: 'production',
      logLevel:    'info',

      // Ship logs to a remote endpoint (optional)
      http: {
        url:       'https://logs.example.com/ingest',
        authToken: process.env.OBS_AUTH_TOKEN,
      },

      // Ship metrics to a remote endpoint (optional)
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
import { NestFactory }              from '@nestjs/core';
import {
  CorrelationInterceptor,
  PerformanceInterceptor,
  AllExceptionsFilter,
  LoggerService,
} from '@backendkit-labs/observability';
import { AppModule }                from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalInterceptors(
    app.get(CorrelationInterceptor),
    app.get(PerformanceInterceptor),
  );

  app.useGlobalFilters(app.get(AllExceptionsFilter));

  // Use LoggerService as the NestJS application logger
  app.useLogger(app.get(LoggerService));

  await app.listen(3000);
}
bootstrap();
```

---

## ObservabilityModule.forRoot options

```typescript
interface ObservabilityOptions {
  serviceName:  string;
  environment?: string;           // default: "production"
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
  circuitBreaker?:  Partial<CircuitBreakerConfig>; // see below
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
  circuitBreaker?:  Partial<CircuitBreakerConfig>; // see below
}
```

---

## CorrelationIdService

Propagates a request-scoped correlation ID through every `await` using `AsyncLocalStorage`.

```typescript
@Injectable()
export class OrdersService {
  constructor(private readonly correlation: CorrelationIdService) {}

  async processOrder(id: string) {
    // Always returns the ID for the current request context
    const cid = this.correlation.get();

    // Or undefined when called outside a context
    const maybeId = this.correlation.getOrUndefined();

    // OTel trace/span IDs (undefined when OTel not installed)
    const trace = this.correlation.getTraceContext();
    // => { traceId: 'abc…', spanId: '123…' } | undefined
  }
}
```

The `CorrelationInterceptor` automatically seeds the context from the incoming `x-correlation-id` header (or generates a fresh UUID) and echoes the ID back in the response header.

---

## LoggerService

Drop-in replacement for NestJS's built-in logger. All log entries include `service`, `environment`, and `correlationId` automatically.

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
      amount,
      currency: 'USD',
      userId: 'u_123',
    });
  }
}
```

### Console output format

```
2024-01-15T10:30:00.000Z [info] Charging card {"service":"payments","correlationId":"a1b2…"}
```

### HTTP transport

When `http` is configured, log entries are buffered in memory and flushed in batches. A built-in circuit breaker pauses sends after repeated failures so logging never blocks your application.

---

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

---

## AllExceptionsFilter

Returns a consistent error shape for every unhandled exception:

```json
{
  "ok": false,
  "statusCode": 404,
  "message": "Resource not found",
  "code": "NOT_FOUND",
  "correlationId": "a1b2c3d4-...",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Custom error mappers

Register domain-specific error classes so they are mapped to the correct HTTP status:

```typescript
import { AllExceptionsFilter, ErrorMapper } from '@backendkit-labs/observability';

// In main.ts, after app.get(AllExceptionsFilter)
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

---

## @TrackPerformance decorator

Wraps any `async` method in an OpenTelemetry span. When OTel is not installed, it becomes a pure pass-through with zero overhead.

```typescript
import { TrackPerformance } from '@backendkit-labs/observability';

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

---

## OpenTelemetry integration

Install `@opentelemetry/api` and configure an SDK (e.g. `@opentelemetry/sdk-node`) separately. This package auto-detects the API and attaches spans — no extra configuration needed here.

```bash
npm install @opentelemetry/api @opentelemetry/sdk-node
```

`CorrelationIdService.getTraceContext()` returns the active `traceId` and `spanId` when OTel is active, useful for log correlation:

```typescript
const trace = this.correlation.getTraceContext();
// { traceId: 'abc123…', spanId: 'def456…' }
```

---

## Circuit breaker behaviour

Both the HTTP log transport and the metrics transport use [`@backendkit-labs/circuit-breaker`](../circuit-breaker) to protect your application from cascading failures in the observability backend:

```
CLOSED ──(failure rate ≥ threshold)──► OPEN ──(openTimeoutMs)──► HALF_OPEN ──(probe succeeds)──► CLOSED
                                                                               └─(probe fails)───► OPEN
```

### Transport defaults

| Option | Default | Description |
|---|---|---|
| `failureThreshold` | `60` | % of calls in the window that must fail to open the circuit |
| `slidingWindowSize` | `5` | Number of calls in the evaluation window |
| `minimumCalls` | `3` | Minimum calls before thresholds are evaluated |
| `openTimeoutMs` | `30 000` | Time to wait in OPEN before transitioning to HALF_OPEN |
| `halfOpenMaxCalls` | `1` | Probe calls allowed in HALF_OPEN |
| `slowCallThreshold` | `100` | % of slow calls to open the circuit (disabled by default) |
| `slowCallDurationMs` | `60 000` | Duration above which a call is considered slow |

### Customising the circuit breaker

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
      openTimeoutMs:     60_000,  // stay open for 60 s
      halfOpenMaxCalls:  2,       // send 2 probes before closing
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

---

## License

MIT
