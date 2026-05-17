---
title: HTTP Client
description: Axios wrapper for Node.js where every request returns Result<T, E> — built-in retry, circuit breaker, cancellation, and NestJS integration.
---

# @backendkit-labs/http-client

[![npm](https://img.shields.io/npm/v/@backendkit-labs/http-client?style=flat-square&color=cb3837)](https://www.npmjs.com/package/@backendkit-labs/http-client)
[![License](https://img.shields.io/npm/l/@backendkit-labs/http-client?style=flat-square)](https://github.com/BackendKit-labs/backendkit-monorepo/blob/master/LICENSE)
[![Node](https://img.shields.io/node/v/@backendkit-labs/http-client?style=flat-square)](https://nodejs.org)

> HTTP client for Node.js where every call returns `Result<T, E>` — retry, circuit breaker, cancellation, and middleware built in.

The standard pattern for HTTP calls is: call, catch, rethrow, forget. `http-client` flips it: every response is an explicit `Result` — successes and failures live in the same type, the compiler forces you to handle both, and infrastructure concerns (retry, circuit breaking) are wired at construction time, not spread across call sites.

## Installation

```bash
npm install @backendkit-labs/http-client
```

NestJS peer dependencies (only for the `/nestjs` subpath):

```bash
npm install @nestjs/common @nestjs/core rxjs
```

## Quick Start

```typescript
import { HttpClient } from '@backendkit-labs/http-client';
import { match } from '@backendkit-labs/result';

const http = new HttpClient({ baseURL: 'https://api.example.com' });

const result = await http.get<User>('/users/42');

match(result, {
  ok:   (res) => console.log(res.data.name, res.status),
  fail: (err) => console.error(err.type, err.status, err.message),
});
```

No `try/catch`. No uncaught promise rejections. The type tells you whether `.value` or `.error` is available.

## Error Types

All failures are returned as `HttpClientError` — never thrown.

```typescript
type HttpErrorType =
  | 'http'          // server returned a non-2xx response
  | 'network'       // no response received (ECONNREFUSED, DNS failure, ...)
  | 'timeout'       // request exceeded the timeout deadline
  | 'circuit-open'  // circuit breaker OPEN — request was not sent
  | 'cancelled';    // cancelled via cancelRequest() or cancelAll()

interface HttpClientError {
  type:     HttpErrorType;
  message:  string;
  status?:  number;   // HTTP status code (only for 'http' errors)
  data?:    unknown;  // response body from the server (only for 'http' errors)
  cause?:   unknown;  // original error object
}
```

:::tip No try/catch needed
All errors are encoded in the return type. The TypeScript compiler enforces that you handle both `ok` and `!ok` branches — there are no uncaught exceptions.
:::

### Routing on error type

```typescript
const result = await http.post<Order>('/orders', body);

match(result, {
  ok: (res) => processOrder(res.data),
  fail: (err) => {
    switch (err.type) {
      case 'http':          return handleApiError(err.status!, err.data);
      case 'network':       return scheduleRetry();
      case 'timeout':       return reportSlaBreach();
      case 'circuit-open':  return serveCachedOrder();
      case 'cancelled':     return; // user navigated away
    }
  },
});
```

## Configuration Reference

```typescript
new HttpClient({
  baseURL: 'https://api.example.com',
  timeout: 10_000,                       // ms — default: 10 000ms
  headers: { 'X-API-Key': process.env.API_KEY },

  retry: {
    attempts:    3,       // retries AFTER the first attempt (3 retries = 4 total calls)
    delayMs:     100,     // initial delay between retries — default: 100ms
    maxDelayMs:  5_000,   // cap on exponential backoff — default: 5 000ms
    jitter:      true,    // full jitter to spread retries — default: true
    // default shouldRetry: network errors, timeouts, and HTTP 5xx
    shouldRetry: (err, attempt) =>
      err.type === 'network' ||
      err.type === 'timeout' ||
      (err.type === 'http' && (err.status ?? 0) >= 500),
  },

  circuitBreaker: {
    failureThreshold:  50,     // open after 50% failures in the window
    minimumCalls:       5,     // calls required before evaluation
    slidingWindowSize: 10,     // count-based sliding window
    openTimeoutMs:  30_000,    // wait before probing again
  },

  // Pre-request middleware — run before every call, in order
  steps: [authStep, correlationIdStep],
})
```

## HTTP Methods

All methods are generic on the response body type `T` and return `Promise<Result<HttpResponse<T>, HttpClientError>>`.

```typescript
interface HttpResponse<T> {
  data:    T;
  status:  number;
  headers: Record<string, string>;
}

http.get<T>(url, config?)
http.post<T>(url, body?, config?)
http.put<T>(url, body?, config?)
http.patch<T>(url, body?, config?)
http.delete<T>(url, config?)
```

### Per-request config

```typescript
interface RequestConfig {
  headers?:       Record<string, string>;
  params?:        Record<string, unknown>;
  timeout?:       number;        // overrides the client-level default for this call
  cancelKey?:     string;        // key for programmatic cancellation
  correlationId?: string;
}
```

```typescript
const result = await http.post<Order>('/orders', dto, {
  params:  { dryRun: true },
  headers: { 'Idempotency-Key': uuid() },
  timeout: 5_000,
});
```

## Request Cancellation

Cancel a request by key — registered synchronously before the network call fires, so it's safe to cancel even before the request starts.

```typescript
// Start a long-running request with a stable key
const promise = http.get('/reports/generate', { cancelKey: 'report' });

// Cancel from anywhere (route change, user action, component unmount)
http.cancelRequest('report');

const result = await promise;
// result.ok === false, result.error.type === 'cancelled'

// Cancel all in-flight requests at once
http.cancelAll();
```

Multiple requests may share the same `cancelKey` — all are cancelled together.

## Retry

Retry is disabled by default (`attempts: 0`). Enable it in the constructor:

```typescript
const http = new HttpClient({
  baseURL: 'https://flaky-service.example.com',
  retry: {
    attempts: 3,      // 3 retries = up to 4 total attempts
    delayMs:  200,    // 200ms → 400ms → 800ms (exponential, capped at maxDelayMs)
    jitter:   true,   // spread retries — prevents thundering herd
  },
});
```

The default `shouldRetry` retries `network`, `timeout`, and `http` errors with status ≥ 500. HTTP 4xx responses are never retried — they are explicit rejection from the server.

Override `shouldRetry` to adjust:

```typescript
retry: {
  attempts: 2,
  shouldRetry: (error, attempt) =>
    error.type !== 'cancelled' &&      // never retry cancellations
    error.status !== 401,              // don't retry auth failures
}
```

## Circuit Breaker

When `circuitBreaker` is configured, the client wraps every request through `@backendkit-labs/circuit-breaker`. Only HTTP 5xx, network, and timeout errors count against the threshold — 4xx responses are transparent.

```typescript
const http = new HttpClient({
  baseURL: 'https://payment-api.example.com',
  circuitBreaker: {
    failureThreshold:  40,    // open at 40% failures
    minimumCalls:       5,
    slidingWindowSize: 10,
    openTimeoutMs:  15_000,   // probe again after 15s
  },
});

const result = await http.post<Charge>('/charges', dto);

if (!result.ok && result.error.type === 'circuit-open') {
  // Payment API is degraded — serve from cache or queue the charge
}
```

## Pipeline Middleware

`steps` run before every request and can read or mutate `HttpCtx` — useful for auth token injection, correlation ID propagation, or request signing. Steps use the `PipelineStep<TContext, TError>` interface from [`@backendkit-labs/pipeline`](/packages/pipeline).

```typescript
import { Ok, Err } from '@backendkit-labs/pipeline';
import type { PipelineStep, StepResult } from '@backendkit-labs/pipeline';
import type { HttpCtx, HttpClientError } from '@backendkit-labs/http-client';

const authStep: PipelineStep<HttpCtx, HttpClientError> = {
  stepName: 'inject-auth',
  async handle(ctx): Promise<StepResult<HttpCtx, HttpClientError>> {
    const token = await tokenStore.get();
    if (!token) return Err({ type: 'network', message: 'No auth token' });
    return Ok({ ...ctx, headers: { ...ctx.headers, Authorization: `Bearer ${token}` } });
  },
};

const correlationStep: PipelineStep<HttpCtx, HttpClientError> = {
  stepName: 'inject-correlation-id',
  async handle(ctx): Promise<StepResult<HttpCtx, HttpClientError>> {
    return Ok({
      ...ctx,
      headers: { ...ctx.headers, 'X-Correlation-ID': ctx.correlationId ?? crypto.randomUUID() },
    });
  },
};

const http = new HttpClient({
  baseURL: 'https://api.example.com',
  steps:   [authStep, correlationStep],  // steps run in order
});
```

If a step returns `Err`, the request is not sent — the error is returned immediately as a `fail` result.

### `HttpCtx` — the mutable request context

```typescript
interface HttpCtx {
  url:            string;
  method:         string;
  data?:          unknown;
  headers:        Record<string, string>;
  params?:        Record<string, unknown>;
  timeout?:       number;
  cancelKey?:     string;
  correlationId?: string;
}
```

## Observability

```typescript
const metrics = http.getMetrics();
// {
//   requests:    142,  // total calls attempted
//   success:     130,  // 2xx responses
//   failed:        8,  // any non-ok result
//   cancelled:     2,  // cancelled via cancelRequest/cancelAll
//   circuitOpen:   1,  // rejected by open circuit breaker (not sent)
//   retried:      12,  // total retry attempts (not counting the initial call)
// }

// Returns undefined if circuitBreaker was not configured
http.getCircuitBreakerState();    // CircuitBreakerState | undefined
http.getCircuitBreakerMetrics();  // CircuitBreakerMetrics | undefined
```

## `defineHttpClient` — Named Clients

Use `defineHttpClient` to create typed injection tokens for multiple named clients:

```typescript
// tokens.ts
import { defineHttpClient } from '@backendkit-labs/http-client';

export const PaymentsApi  = defineHttpClient('payments-api');
export const InventoryApi = defineHttpClient('inventory-api');
```

These tokens are used with the NestJS module below, and can also be used as keys in any manual DI container.

## NestJS Integration

### `HttpClientModule.forRoot()`

```typescript
import { HttpClientModule } from '@backendkit-labs/http-client/nestjs';
import { PaymentsApi, InventoryApi } from './tokens';

@Module({
  imports: [
    HttpClientModule.forRoot({
      clients: [
        {
          token:  PaymentsApi,
          config: {
            baseURL: 'https://payments.example.com',
            timeout: 15_000,
            retry:   { attempts: 3, delayMs: 100, maxDelayMs: 2_000 },
            circuitBreaker: { failureThreshold: 40, minimumCalls: 5, slidingWindowSize: 10, openTimeoutMs: 30_000 },
          },
        },
        {
          token:  InventoryApi,
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

`HttpClientModule` is a **global module** — clients registered in `AppModule` are available everywhere without re-importing.

### `HttpClientModule.forRootAsync()` — config from `ConfigService`

```typescript
HttpClientModule.forRootAsync({
  clients:    [PaymentsApi, InventoryApi],   // declare which tokens to register
  imports:    [ConfigModule],
  inject:     [ConfigService],
  useFactory: (config: ConfigService): HttpClientModuleOptions => ({
    clients: [
      {
        token:  PaymentsApi,
        config: {
          baseURL: config.get('PAYMENTS_API_URL'),
          timeout: config.get<number>('PAYMENTS_TIMEOUT_MS'),
        },
      },
      {
        token:  InventoryApi,
        config: { baseURL: config.get('INVENTORY_API_URL') },
      },
    ],
  }),
});
```

### `@InjectHttpClient(token)` — inject into services

```typescript
import { Injectable } from '@nestjs/common';
import { InjectHttpClient } from '@backendkit-labs/http-client/nestjs';
import type { HttpClient } from '@backendkit-labs/http-client';
import { match } from '@backendkit-labs/result';
import { PaymentsApi, InventoryApi } from './tokens';

@Injectable()
export class CheckoutService {
  constructor(
    @InjectHttpClient(PaymentsApi)  private readonly payments: HttpClient,
    @InjectHttpClient(InventoryApi) private readonly inventory: HttpClient,
  ) {}

  async checkout(cart: Cart) {
    const stock = await this.inventory.get<StockCheck>(`/stock/${cart.skuId}`);
    if (!stock.ok) return stock; // propagate inventory error upstream

    if (stock.value.data.available < cart.quantity) {
      return fail({ type: 'http' as const, message: 'Insufficient stock', status: 409 });
    }

    return this.payments.post<Order>('/orders', {
      skuId: cart.skuId, quantity: cart.quantity, userId: cart.userId,
    });
  }
}
```

## Composition with `@backendkit-labs/result`

Because every call already returns `Result`, it composes directly with the full toolkit:

```typescript
import { flatMapAsync, withTimeout } from '@backendkit-labs/result';

// Chain calls — second only fires if first succeeds
const order = await flatMapAsync(
  await http.get<User>(`/users/${userId}`),
  (userRes) => http.post<Order>('/orders', { userId: userRes.data.id }),
);

// Apply a hard deadline across all retries
const report = await withTimeout(
  () => http.get<Report>('/reports/heavy'),
  30_000,
  { type: 'timeout' as const, message: 'Report generation exceeded 30s SLA' },
);
```

## Architecture

```
@backendkit-labs/http-client          (core — peer dep: axios)
  HttpClient                          main class — all methods return Result<T, E>
  CancelManager                       per-key and bulk request cancellation
  defineHttpClient(name)              named token factory for DI
  HttpClientToken                     typed injection token class

  HttpClientError                     discriminated union: http | network | timeout | circuit-open | cancelled
  HttpResponse<T>                     { data, status, headers }
  HttpCtx                             mutable context object passed through middleware steps

@backendkit-labs/http-client/nestjs  (optional NestJS layer)
  HttpClientModule                    global DynamicModule — forRoot() / forRootAsync()
  @InjectHttpClient(token)            parameter decorator for constructor injection
```
