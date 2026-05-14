# @backendkit-labs/http-client

[![npm version](https://img.shields.io/npm/v/@backendkit-labs/http-client?style=flat-square&color=cb3837)](https://www.npmjs.com/package/@backendkit-labs/http-client)
[![CI](https://img.shields.io/github/actions/workflow/status/backendkit-dev/backendkit-monorepo/ci.yml?style=flat-square&label=CI)](https://github.com/backendkit-dev/backendkit-monorepo/actions/workflows/ci.yml)
[![License](https://img.shields.io/npm/l/@backendkit-labs/http-client?style=flat-square)](LICENSE)
[![Node](https://img.shields.io/node/v/@backendkit-labs/http-client?style=flat-square)](package.json)

> Production-grade HTTP client for Node.js — built on axios with circuit breaker, retry with exponential backoff, typed `Result<T, E>` responses, request cancellation, pre-request pipeline middleware, and optional NestJS DI integration.

Every method returns `Result<HttpResponse<T>, HttpClientError>` — no try/catch needed, no unhandled rejections, always typed.

---

## Installation

```bash
npm install @backendkit-labs/http-client axios
```

NestJS peer dependencies (only for the `/nestjs` subpath):

```bash
npm install @nestjs/common @nestjs/core rxjs
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

`"bundler"`, `"node16"`, and `"nodenext"` all understand the `exports` field natively.

**Legacy resolution (`"node"`) — add `paths` aliases:**

```json
{
  "compilerOptions": {
    "moduleResolution": "node",
    "paths": {
      "@backendkit-labs/http-client/nestjs": [
        "./node_modules/@backendkit-labs/http-client/dist/nestjs/index.d.ts"
      ]
    }
  }
}
```

**NestJS decorator support:**

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

And in your `main.ts`, before anything else:

```typescript
import 'reflect-metadata';
```

---

## Quick Start

```typescript
import { HttpClient } from '@backendkit-labs/http-client';

const client = new HttpClient({
  baseURL: 'https://api.example.com',
  timeout: 5_000,
});

// All methods return Result<HttpResponse<T>, HttpClientError>
const result = await client.get<User[]>('/users');

if (result.ok) {
  console.log(result.value.data);   // User[]
  console.log(result.value.status); // 200
} else {
  console.error(result.error.type);   // 'http' | 'network' | 'timeout' | 'cancelled' | 'circuit-open'
  console.error(result.error.status); // 404, 500, etc. (for 'http' type)
}
```

---

## Configuration

```typescript
const client = new HttpClient({
  baseURL:  'https://api.example.com',
  timeout:  10_000,          // default: 10 000 ms
  headers:  { 'X-API-Key': 'secret' },

  // Retry with exponential backoff + jitter
  retry: {
    attempts:    3,           // retries after first failure
    delayMs:     100,
    maxDelayMs:  5_000,
    jitter:      true,
    shouldRetry: (err) => err.type === 'network' || err.type === 'timeout',
  },

  // Circuit breaker
  circuitBreaker: {
    failureThreshold:  50,    // % of calls that must fail to open the circuit
    minimumCalls:      5,     // minimum calls before evaluating thresholds
    slidingWindowSize: 10,
    openTimeoutMs:     30_000,
  },

  // Pre-request middleware steps
  steps: [authStep, correlationIdStep],
});
```

---

## HTTP Methods

All methods accept an optional `RequestConfig`:

```typescript
interface RequestConfig {
  headers?:       Record<string, string>;
  params?:        Record<string, unknown>;   // query string parameters
  timeout?:       number;                    // per-request override
  cancelKey?:     string;                    // key to cancel this request
  correlationId?: string;
}
```

```typescript
client.get<T>(url, config?)
client.post<T>(url, data?, config?)
client.put<T>(url, data?, config?)
client.patch<T>(url, data?, config?)
client.delete<T>(url, config?)
```

---

## Error Types

```typescript
type HttpErrorType = 'http' | 'network' | 'timeout' | 'cancelled' | 'circuit-open';

interface HttpClientError {
  type:     HttpErrorType;
  message:  string;
  status?:  number;   // only for 'http'
  data?:    unknown;  // response body, only for 'http'
  cause?:   unknown;  // original axios error
}
```

---

## Request Cancellation

Register a `cancelKey` on the request and cancel by key at any time:

```typescript
const promise = client.get('/long-poll', { cancelKey: 'my-poll' });

// Cancel a specific request
client.cancelRequest('my-poll');

// Cancel all in-flight requests
client.cancelAll();

const result = await promise;
if (!result.ok && result.error.type === 'cancelled') {
  // handle cancellation
}
```

---

## Pipeline Middleware

Pre-request middleware steps transform the `HttpCtx` before each request. Steps are powered by `@backendkit-labs/pipeline`.

```typescript
import type { PipelineStep, StepResult } from '@backendkit-labs/pipeline';
import { Ok } from '@backendkit-labs/pipeline';
import type { HttpCtx, HttpClientError } from '@backendkit-labs/http-client';

const authStep: PipelineStep<HttpCtx, HttpClientError> = {
  stepName: 'auth',
  async handle(ctx): Promise<StepResult<HttpCtx, HttpClientError>> {
    const token = await tokenStore.get();
    return Ok({ ...ctx, headers: { ...ctx.headers, Authorization: `Bearer ${token}` } });
  },
};

const client = new HttpClient({ steps: [authStep] });
```

A step can abort the request by returning `Err(...)`:

```typescript
import { Err } from '@backendkit-labs/pipeline';

const rateLimitStep: PipelineStep<HttpCtx, HttpClientError> = {
  stepName: 'rate-limit',
  async handle(ctx): Promise<StepResult<HttpCtx, HttpClientError>> {
    if (await rateLimiter.isExceeded()) {
      return Err({ type: 'network', message: 'Rate limit exceeded' });
    }
    return Ok(ctx);
  },
};
```

---

## Observability

```typescript
// Snapshot of lifetime counters
client.getMetrics();
// → { requests, success, failed, cancelled, circuitOpen, retried }

// Circuit breaker state and counters
client.getCircuitBreakerState();   // 'closed' | 'open' | 'half_open' | undefined
client.getCircuitBreakerMetrics(); // detailed metrics or undefined
```

---

## NestJS Integration

### Module registration

```typescript
// Define typed injection tokens
export const PRIMARY_API   = defineHttpClient('primary-api');
export const PAYMENTS_API  = defineHttpClient('payments-api');
```

```typescript
import { HttpClientModule } from '@backendkit-labs/http-client/nestjs';
import { PRIMARY_API, PAYMENTS_API } from './tokens';

@Module({
  imports: [
    HttpClientModule.forRoot({
      clients: [
        { token: PRIMARY_API,  config: { baseURL: 'https://api.example.com',     retry: { attempts: 3, delayMs: 100 } } },
        { token: PAYMENTS_API, config: { baseURL: 'https://payments.example.com', circuitBreaker: { failureThreshold: 40, minimumCalls: 3 } } },
      ],
    }),
  ],
})
export class AppModule {}
```

### Injection

```typescript
import { InjectHttpClient } from '@backendkit-labs/http-client/nestjs';
import { PRIMARY_API } from './tokens';

@Injectable()
export class UserService {
  constructor(
    @InjectHttpClient(PRIMARY_API) private readonly http: HttpClient,
  ) {}

  async getUsers(): Promise<User[]> {
    const result = await this.http.get<User[]>('/users');
    if (!result.ok) throw new Error(result.error.message);
    return result.value.data;
  }
}
```

### Async module registration

```typescript
HttpClientModule.forRootAsync({
  imports: [ConfigModule],
  inject:  [ConfigService],
  useFactory: (config: ConfigService) => ({
    clients: [{
      token:  PRIMARY_API,
      config: { baseURL: config.get('API_URL'), timeout: config.get('API_TIMEOUT') },
    }],
  }),
}),
```

---

## Named Clients

```typescript
import { defineHttpClient, HttpClientToken } from '@backendkit-labs/http-client';

export const GITHUB_API: HttpClientToken = defineHttpClient('github-api');

// Provides the token's symbol as the NestJS DI token:
// Inject with @InjectHttpClient(GITHUB_API)
```

---

## License

Apache-2.0
