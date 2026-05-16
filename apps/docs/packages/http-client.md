---
title: HTTP Client
description: Production-grade HTTP client built on axios — Result-based API, circuit breaker, retry with backoff, request cancellation, and pipeline middleware.
---

# @backendkit-labs/http-client

[![npm](https://img.shields.io/npm/v/@backendkit-labs/http-client?style=flat-square&color=cb3837)](https://www.npmjs.com/package/@backendkit-labs/http-client)
[![License](https://img.shields.io/npm/l/@backendkit-labs/http-client?style=flat-square)](https://github.com/BackendKit-labs/backendkit-monorepo/blob/master/LICENSE)
[![Node](https://img.shields.io/node/v/@backendkit-labs/http-client?style=flat-square)](https://nodejs.org)

> Production-grade HTTP client built on axios. Every method returns `Result<HttpResponse<T>, HttpClientError>` — no try/catch required.

Integrates a circuit breaker, retry with exponential backoff, request cancellation, and pre-request pipeline middleware. Optional NestJS DI integration for named, independently configured clients.

## Installation

```bash
npm install @backendkit-labs/http-client axios
```

NestJS peer dependencies (only for the `/nestjs` subpath):

```bash
npm install @nestjs/common @nestjs/core rxjs
```

## Quick Start

```typescript
import { HttpClient } from '@backendkit-labs/http-client';

const client = new HttpClient({
  baseURL: 'https://api.example.com',
  timeout: 10_000,
});

const result = await client.get<User>('/users/42');

if (result.ok) {
  console.log(result.value.data);    // User
  console.log(result.value.status);  // 200
} else {
  console.error(result.error.type);    // 'http' | 'network' | 'timeout' | ...
  console.error(result.error.status);  // 404, 500, undefined (for network errors)
}
```

## Error Types

All failures are returned as `HttpClientError` — never thrown.

```typescript
type HttpErrorType =
  | 'http'          // received a response with a non-2xx status code
  | 'network'       // request never reached the server (ECONNREFUSED, ENOTFOUND, ...)
  | 'timeout'       // axios timeout or circuit breaker slow-call threshold exceeded
  | 'cancelled'     // cancelled via cancelRequest() or cancelAll()
  | 'circuit-open'; // circuit breaker rejected the request before it was sent

interface HttpClientError {
  type:     HttpErrorType;
  message:  string;
  status?:  number;           // HTTP status (http errors only)
  data?:    unknown;          // response body (http errors only)
  cause?:   unknown;          // original axios error
}
```

:::info No try/catch
Because all errors are encoded in the return type, you never need a try/catch around HTTP calls. The compiler enforces that you handle both `ok` and `!ok` branches.
:::

## Configuration Reference

```typescript
new HttpClient({
  // Base request config
  baseURL:  'https://api.example.com',
  timeout:  10_000,                           // ms — default: 30_000
  headers:  { 'X-API-Key': process.env.API_KEY },

  // Retry with exponential backoff
  retry: {
    attempts:    3,                           // max total attempts (including the first)
    delayMs:     100,                         // initial delay between retries
    maxDelayMs:  5_000,                       // cap on backoff delay
    jitter:      true,                        // full jitter to spread retries
    shouldRetry: (err) =>
      err.type === 'network' || err.type === 'timeout',
  },

  // Circuit breaker
  circuitBreaker: {
    failureThreshold:  50,    // % of calls that must fail to open
    minimumCalls:      5,     // calls required before threshold is evaluated
    slidingWindowSize: 10,    // count-based window size
    openTimeoutMs:     30_000,
  },

  // Pre-request pipeline middleware (executed in order before every request)
  steps: [authStep, correlationIdStep],
})
```

### Retry jitter

| `jitter` value | Behaviour |
|---|---|
| `false` / omitted | Deterministic backoff — no randomness |
| `true` | Full jitter: `random(0, computedDelay)` — best for high-concurrency scenarios |
| `0.0–1.0` | Partial jitter: `delay ± (delay × factor)` — preserves backoff shape with light noise |

## HTTP Methods

All methods are generic on the response body type `T` and return `Promise<Result<HttpResponse<T>, HttpClientError>>`.

```typescript
interface HttpResponse<T> {
  data:    T;
  status:  number;
  headers: Record<string, string>;
}

client.get<T>(url, config?)
client.post<T>(url, body?, config?)
client.put<T>(url, body?, config?)
client.patch<T>(url, body?, config?)
client.delete<T>(url, config?)
```

`config` accepts any axios request config properties (`params`, `headers`, `signal`, `cancelKey`, etc.) in addition to the per-request options below.

```typescript
// Typed POST with query params
const result = await client.post<Order>('/orders', dto, {
  params:  { dryRun: true },
  headers: { 'Idempotency-Key': uuid() },
});
```

## Request Cancellation

Requests can be cancelled by a string key. Multiple requests may share the same key — all are cancelled together.

```typescript
// Start a polling request with a stable key
client.get('/events/poll', { cancelKey: 'events-poll' });

// Cancel it elsewhere (route change, component unmount, etc.)
client.cancelRequest('events-poll');

// Cancel every in-flight request
client.cancelAll();
```

Cancelled requests resolve with `result.ok === false` and `result.error.type === 'cancelled'` — they do not throw.

## Pipeline Middleware

`steps` in the config are `PipelineStep<HttpCtx, HttpClientError>` instances from [`@backendkit-labs/pipeline`](/packages/pipeline). They run before every request and can modify the request context (URL, headers, body, params).

```typescript
import { Ok, Err } from '@backendkit-labs/pipeline';
import type { PipelineStep, StepResult } from '@backendkit-labs/pipeline';
import type { HttpCtx, HttpClientError } from '@backendkit-labs/http-client';

const authStep: PipelineStep<HttpCtx, HttpClientError> = {
  stepName: 'auth',
  async handle(ctx): Promise<StepResult<HttpCtx, HttpClientError>> {
    const token = await tokenStore.get();
    if (!token) return Err({ type: 'network', message: 'No auth token available' });
    return Ok({
      ...ctx,
      headers: { ...ctx.headers, Authorization: `Bearer ${token}` },
    });
  },
};

const correlationIdStep: PipelineStep<HttpCtx, HttpClientError> = {
  stepName: 'correlation-id',
  async handle(ctx): Promise<StepResult<HttpCtx, HttpClientError>> {
    return Ok({
      ...ctx,
      headers: { ...ctx.headers, 'X-Correlation-ID': correlationStore.get() ?? uuid() },
    });
  },
};

const client = new HttpClient({
  baseURL: 'https://api.example.com',
  steps:   [authStep, correlationIdStep],
});
```

If any middleware step returns `Err`, the request is not sent and the error is returned immediately.

## Observability

```typescript
const metrics = client.getMetrics();
// {
//   requests:     142,   // total requests attempted
//   success:      130,
//   failed:        8,
//   cancelled:     2,
//   circuitOpen:   1,    // rejected before sending (circuit open)
//   retried:      12,    // total retry attempts across all requests
// }

const cbState = client.getCircuitBreakerState();
// 'closed' | 'open' | 'half_open' | undefined (if circuit breaker not configured)

const cbMetrics = client.getCircuitBreakerMetrics();
// Full CircuitBreakerMetrics object — see @backendkit-labs/circuit-breaker
```

## NestJS Integration

### Define client tokens

```typescript
// http-client.tokens.ts
import { defineHttpClient } from '@backendkit-labs/http-client';

export const PAYMENTS_API  = defineHttpClient('payments-api');
export const INVENTORY_API = defineHttpClient('inventory-api');
```

`defineHttpClient(name)` returns an injection token typed to `HttpClient`. The `name` is used in error messages and metrics.

### Register with `HttpClientModule`

```typescript
// app.module.ts
import { HttpClientModule } from '@backendkit-labs/http-client/nestjs';

@Module({
  imports: [
    HttpClientModule.forRoot({
      clients: [
        {
          token:  PAYMENTS_API,
          config: {
            baseURL: 'https://payments.example.com',
            timeout: 15_000,
            retry:   { attempts: 3, delayMs: 100, maxDelayMs: 2_000 },
            circuitBreaker: { failureThreshold: 40, minimumCalls: 5, slidingWindowSize: 10, openTimeoutMs: 30_000 },
          },
        },
        {
          token:  INVENTORY_API,
          config: {
            baseURL: 'https://inventory.example.com',
            timeout: 5_000,
            retry:   { attempts: 2, delayMs: 50 },
          },
        },
      ],
    }),
  ],
})
export class AppModule {}
```

### Inject and use

```typescript
// checkout.service.ts
import { InjectHttpClient } from '@backendkit-labs/http-client/nestjs';

@Injectable()
export class CheckoutService {
  constructor(
    @InjectHttpClient(PAYMENTS_API)  private readonly payments: HttpClient,
    @InjectHttpClient(INVENTORY_API) private readonly inventory: HttpClient,
  ) {}

  async checkout(cart: Cart) {
    const stockResult = await this.inventory.get<StockCheck>(`/stock/${cart.skuId}`);
    if (!stockResult.ok) return stockResult; // propagate error

    if (stockResult.value.data.available < cart.quantity) {
      return Err({ type: 'http', message: 'Insufficient stock', status: 409 });
    }

    return this.payments.post<Order>('/orders', {
      skuId:    cart.skuId,
      quantity: cart.quantity,
      userId:   cart.userId,
    });
  }
}
```

## TypeScript Configuration

### Modern bundler (`moduleResolution: bundler` or `node16`)

Subpath exports resolve automatically — no extra configuration needed.

```json
{
  "compilerOptions": {
    "moduleResolution": "bundler"
  }
}
```

### Legacy `node` moduleResolution

Add a path alias for the NestJS subpath:

```json
{
  "compilerOptions": {
    "moduleResolution": "node",
    "paths": {
      "@backendkit-labs/http-client/nestjs": [
        "./node_modules/@backendkit-labs/http-client/dist/nestjs/index"
      ]
    }
  }
}
```

## Architecture

```
@backendkit-labs/http-client              (core — peer dep: axios >=1.0.0)
  HttpClient                              axios wrapper — Result-based methods
  HttpClientError                         typed error union (http/network/timeout/...)
  HttpResponse<T>                         typed response envelope
  HttpCtx                                 pipeline middleware context type
  defineHttpClient(name)                  typed injection token factory

@backendkit-labs/http-client/nestjs       (optional NestJS layer)
  HttpClientModule                        NestJS module — .forRoot() registration
  InjectHttpClient(token)                 parameter decorator for DI
```
