# @backendkit-labs/rate-limiter

[![npm version](https://img.shields.io/npm/v/@backendkit-labs/rate-limiter?style=flat-square&color=cb3837)](https://www.npmjs.com/package/@backendkit-labs/rate-limiter)
[![CI](https://img.shields.io/github/actions/workflow/status/BackendKit-labs/backendkit-monorepo/ci.yml?style=flat-square&label=CI)](https://github.com/BackendKit-labs/backendkit-monorepo/actions/workflows/ci.yml)
[![License](https://img.shields.io/npm/l/@backendkit-labs/rate-limiter?style=flat-square)](LICENSE)
[![Node](https://img.shields.io/node/v/@backendkit-labs/rate-limiter?style=flat-square)](package.json)
[![Docs](https://img.shields.io/badge/docs-backendkitlabs.dev-4f7eff?style=flat-square)](https://backendkitlabs.dev/docs/rate-limiter/)

> Modular rate limiter for Node.js — token bucket, fixed window, sliding window log & counter, with Redis atomic Lua scripts and optional NestJS integration.

Four battle-tested algorithms, one unified interface. Starts in-memory with no dependencies and scales to Redis without changing application code. Each algorithm returns a rich `RateLimitResult` so you can write correct `Retry-After` headers and expose standard `X-RateLimit-*` headers from a single result object.

Optional NestJS integration included — module, guard, and method decorator.

---

## Minimal Example

Self-contained runnable example — Express server with all four algorithms and k6 load tests:

```bash
git clone https://github.com/BackendKit-labs/backendkit-monorepo.git
cd backendkit-monorepo/examples/rate-limiter-k6
npm install && npm start
# then in another terminal:
npm run k6:smoke
```

Shows token bucket, fixed window, sliding window, and multi-weight endpoints. k6 burst test reaches 50 VUs and verifies 100% fail-fast with zero 5xx. → [full source](https://github.com/BackendKit-labs/backendkit-monorepo/tree/master/examples/rate-limiter-k6)

---

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Algorithms](#algorithms)
  - [Token Bucket](#token-bucket)
  - [Fixed Window](#fixed-window)
  - [Sliding Window Log](#sliding-window-log)
  - [Sliding Window Counter](#sliding-window-counter)
  - [Choosing an Algorithm](#choosing-an-algorithm)
- [RateLimiter API](#ratelimiter-api)
  - [consume()](#consume)
  - [check()](#check)
  - [reset() / resetAll()](#reset--resetall)
  - [RateLimitResult](#ratelimitresult)
- [Configuration Reference](#configuration-reference)
- [Redis Store](#redis-store)
  - [Basic Setup](#basic-setup)
  - [Circuit Breaker Integration](#circuit-breaker-integration)
- [Multi-weight Requests](#multi-weight-requests)
- [Rate Limit Headers](#rate-limit-headers)
- [NestJS Integration](#nestjs-integration)
  - [Module Setup](#module-setup)
  - [Guard — global or per-route](#guard--global-or-per-route)
  - [Decorator — per method](#decorator--per-method)
  - [Async Configuration](#async-configuration)
- [TypeScript Configuration](#typescript-configuration)
- [Architecture](#architecture)

---

## Installation

```bash
npm install @backendkit-labs/rate-limiter
```

Redis support (optional peer dependency):

```bash
npm install ioredis
```

NestJS peer dependencies (only needed for the `/nestjs` subpath):

```bash
npm install @nestjs/common @nestjs/core rxjs
```

Circuit breaker for Redis resilience (optional):

```bash
npm install @backendkit-labs/circuit-breaker
```

---

## Quick Start

```typescript
import { RateLimiterFactory, TokenBucketConfig } from '@backendkit-labs/rate-limiter';

const config: TokenBucketConfig = {
  algorithm:        'token-bucket',
  store:            'memory',
  bucketSize:       10,
  tokensPerSecond:  2,
  keyPrefix:        'api:',
};

const limiter = RateLimiterFactory.create(config);

// In your HTTP handler:
const result = await limiter.consume(req.ip ?? 'unknown');

if (!result.ok) {
  // Store error — log and let the request through (fail open) or return 503
  res.status(503).json({ error: 'rate_limiter_unavailable' });
  return;
}

if (!result.value.allowed) {
  res
    .status(429)
    .set('Retry-After', String(Math.ceil((result.value.resetAt - Date.now()) / 1000)))
    .json({ error: 'too_many_requests', retryAfter: result.value.resetAt });
  return;
}

res.json({ data: 'ok', remaining: result.value.remaining });
```

---

## Algorithms

### Token Bucket

Tokens accumulate at a fixed rate up to `bucketSize`. Each request consumes one (or more) tokens. Ideal for smooth bursty traffic — a client that has been idle earns tokens back and can briefly send a burst before being throttled.

```typescript
import { RateLimiterFactory, TokenBucketConfig } from '@backendkit-labs/rate-limiter';

const config: TokenBucketConfig = {
  algorithm:        'token-bucket',
  store:            'memory',
  bucketSize:       20,        // max burst
  tokensPerSecond:  5,         // steady-state refill
  initialTokens:    20,        // optional — defaults to bucketSize
  keyPrefix:        'tb:',
};

const limiter = RateLimiterFactory.create(config);
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `bucketSize` | `number` | yes | Maximum token capacity (max burst) |
| `tokensPerSecond` | `number` | yes | Token refill rate |
| `initialTokens` | `number` | no | Starting tokens — defaults to `bucketSize` |

**When to use:** APIs that need to allow bursts (mobile clients, batch importers) while enforcing a long-term average rate.

---

### Fixed Window

Counts requests inside fixed, non-overlapping time windows (e.g., 0–10s, 10–20s). Simple and efficient, but susceptible to a boundary burst — a client can send `2 × maxRequests` in a short window straddling a boundary.

```typescript
import { RateLimiterFactory, FixedWindowConfig } from '@backendkit-labs/rate-limiter';

const config: FixedWindowConfig = {
  algorithm:    'fixed-window',
  store:        'memory',
  windowMs:     60_000,   // 1 minute window
  maxRequests:  100,
  keyPrefix:    'fw:',
};

const limiter = RateLimiterFactory.create(config);
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `windowMs` | `number` | yes | Window duration in milliseconds |
| `maxRequests` | `number` | yes | Allowed requests per window |

**When to use:** Simple per-minute or per-hour limits where the boundary burst is acceptable. Lowest memory footprint per key.

---

### Sliding Window Log

Stores a timestamp for every request. At consume time, entries older than `windowMs` are evicted and the count is checked. Exact enforcement with no boundary burst.

```typescript
import { RateLimiterFactory, SlidingWindowLogConfig } from '@backendkit-labs/rate-limiter';

const config: SlidingWindowLogConfig = {
  algorithm:    'sliding-window-log',
  store:        'memory',
  windowMs:     60_000,
  maxRequests:  100,
  keyPrefix:    'swl:',
};

const limiter = RateLimiterFactory.create(config);
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `windowMs` | `number` | yes | Sliding window duration |
| `maxRequests` | `number` | yes | Allowed requests in any `windowMs` span |

**When to use:** Strict SLAs where the exact number of requests in any rolling window matters. Higher memory per key (O(maxRequests) timestamps).

---

### Sliding Window Counter

Hybrid approach — two fixed sub-windows with a weighted interpolation. Substantially more accurate than a plain fixed window, much lower memory than the log variant, because it only stores two counters per key.

```typescript
import { RateLimiterFactory, SlidingWindowCounterConfig } from '@backendkit-labs/rate-limiter';

const config: SlidingWindowCounterConfig = {
  algorithm:    'sliding-window-counter',
  store:        'memory',
  windowMs:     60_000,
  maxRequests:  100,
  keyPrefix:    'swc:',
};

const limiter = RateLimiterFactory.create(config);
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `windowMs` | `number` | yes | Window duration |
| `maxRequests` | `number` | yes | Allowed requests per window |

**When to use:** High-traffic production APIs where memory matters and approximate sliding accuracy (±10%) is acceptable. Recommended default for most use cases.

---

### Choosing an Algorithm

| Algorithm | Accuracy | Memory per key | Burst handling | Best for |
|-----------|----------|---------------|----------------|----------|
| Token Bucket | Exact | O(1) | Allows controlled bursts | APIs with bursty clients |
| Fixed Window | Approximate | O(1) | Vulnerable to boundary burst | Simple quotas, low-traffic |
| Sliding Window Log | Exact | O(maxRequests) | No boundary burst | Strict SLAs |
| Sliding Window Counter | ~Exact | O(1) | Minimal boundary effect | High-traffic production default |

---

## RateLimiter API

### `consume()`

Attempts to consume one token (or `weight` tokens) for the given key. Returns a `Result<RateLimitResult, RateLimitError>`.

```typescript
// Consume one token
const result = await limiter.consume(clientKey);

// Consume multiple tokens (multi-weight request)
const result = await limiter.consume(clientKey, 3);

if (!result.ok) {
  // Store failure — handle or let through
  console.error(result.error.message);
  return;
}

const { allowed, remaining, resetAt, totalLimit } = result.value;
```

The return type uses the `@backendkit-labs/result` monad:

```typescript
type Result<T, E> =
  | { ok: true;  value: T }
  | { ok: false; error: E };
```

`!result.ok` means the **store** failed (Redis down, connection error) — not that the request was rate-limited. A rate-limited request returns `{ ok: true, value: { allowed: false, ... } }`.

### `check()`

Reads current state without consuming a token. Useful for preflight checks or status endpoints.

```typescript
const status = await limiter.check(clientKey);
// Returns RateLimitResult (always, not wrapped in Result)
console.log(status.remaining, status.resetAt);
```

### `reset() / resetAll()`

```typescript
// Reset a specific key
await limiter.reset(clientKey);

// Reset all keys (clears the entire store)
await limiter.resetAll();
```

### `RateLimitResult`

```typescript
interface RateLimitResult {
  key:        string;   // The key that was consumed
  allowed:    boolean;  // true = request allowed, false = rate limited (429)
  remaining:  number;   // Tokens/requests remaining in the current window
  resetAt:    number;   // Unix timestamp (ms) when the window resets
  totalLimit: number;   // The configured limit (bucketSize or maxRequests)
}
```

---

## Configuration Reference

All algorithm configs extend the base `RateLimiterConfig`:

```typescript
interface RateLimiterConfig {
  algorithm:      AlgorithmType | IRateLimiterAlgorithm; // required
  store?:         'memory' | 'redis' | IRateLimiterStore; // default: 'memory'
  redisOptions?:  Record<string, unknown>;               // ioredis options when store='redis'
  keyPrefix?:     string;                                // default: 'rl:'
  circuitBreaker?: RateLimiterCircuitBreakerConfig;      // only affects redis store
  logger?:        ILogger;                               // optional structured logger
  metrics?:       IMetricsRecorder;                      // optional metrics recorder
}
```

**Circuit breaker config** (only active when `store: 'redis'`):

```typescript
interface RateLimiterCircuitBreakerConfig {
  failureThreshold?: number;   // % Redis failures to open circuit (default: 50)
  openTimeoutMs?:    number;   // ms to wait before probing Redis again (default: 30_000)
  minimumCalls?:     number;   // min calls before evaluating threshold (default: 3)
  slidingWindowSize?: number;  // window size (default: 5)
  fallbackToMemory?: boolean;  // serve from in-process memory while open (default: true)
  onStateChange?:    (from: string, to: string) => void;
}
```

---

## Redis Store

### Basic Setup

Pass `store: 'redis'` and provide `redisOptions` — the library creates an `ioredis` client internally.

```typescript
import { RateLimiterFactory, SlidingWindowCounterConfig } from '@backendkit-labs/rate-limiter';

const config: SlidingWindowCounterConfig = {
  algorithm:    'sliding-window-counter',
  store:        'redis',
  redisOptions: {
    host:     process.env['REDIS_HOST'] ?? '127.0.0.1',
    port:     parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
    password: process.env['REDIS_PASSWORD'],
    tls:      process.env['REDIS_TLS'] === 'true' ? {} : undefined,
  },
  windowMs:     60_000,
  maxRequests:  100,
  keyPrefix:    'api:rl:',
};

const limiter = RateLimiterFactory.create(config);
```

The Redis store runs all algorithm logic as **atomic Lua scripts** via `EVALSHA` (with `EVAL` fallback on `NOSCRIPT`). This means consume + check + update is a single round-trip with no race conditions — safe for multi-instance deployments.

You can also pass a pre-configured `ioredis` instance:

```typescript
import Redis from 'ioredis';
import { RedisStore } from '@backendkit-labs/rate-limiter';

const redis = new Redis({ host: '127.0.0.1', port: 6379 });
const store = new RedisStore(redis);

const limiter = RateLimiterFactory.create({
  algorithm:  'fixed-window',
  store,
  windowMs:   60_000,
  maxRequests: 50,
});
```

### Circuit Breaker Integration

Protects your application when Redis is unavailable. When the circuit opens, the limiter transparently falls back to the in-process `MemoryStore`. Requires `@backendkit-labs/circuit-breaker`.

```typescript
const config: SlidingWindowCounterConfig = {
  algorithm:    'sliding-window-counter',
  store:        'redis',
  redisOptions: { host: process.env['REDIS_HOST'] },
  windowMs:     60_000,
  maxRequests:  100,
  circuitBreaker: {
    failureThreshold: 60,           // open after 60% Redis failures
    openTimeoutMs:    30_000,       // probe Redis again after 30s
    fallbackToMemory: true,         // serve in-memory while circuit is open
    onStateChange: (from, to) => {
      logger.warn(`Rate limiter Redis circuit: ${from} → ${to}`);
    },
  },
};
```

With `fallbackToMemory: true`, limits are enforced locally per instance while Redis recovers. Each instance has its own counter, so the effective limit is `maxRequests × instanceCount` during the outage — a reasonable trade-off for continued availability.

---

## Multi-weight Requests

Some operations should cost more than one token — large uploads, expensive queries, batch endpoints.

```typescript
// This request costs 3 tokens
const result = await limiter.consume(req.ip ?? 'unknown', 3);

if (result.ok && !result.value.allowed) {
  res.status(429).json({ error: 'too_many_requests' });
  return;
}
```

Token Bucket is the most natural fit: a bucket of 20 tokens refilling at 5/s lets a client make up to 6 cheap (weight=1) requests or 1 expensive (weight=3) request in a given moment without conflating the two.

---

## Rate Limit Headers

Map `RateLimitResult` to standard HTTP headers:

```typescript
function setRateLimitHeaders(res: Response, result: RateLimitResult): void {
  const resetSec = Math.ceil(result.resetAt / 1000);
  const retryAfter = Math.ceil(Math.max(result.resetAt - Date.now(), 0) / 1000);

  res.set('X-RateLimit-Limit',     String(result.totalLimit));
  res.set('X-RateLimit-Remaining', String(result.remaining));
  res.set('X-RateLimit-Reset',     String(resetSec));

  if (!result.allowed) {
    res.set('Retry-After', String(retryAfter));
  }
}

// Usage
const result = await limiter.consume(clientKey);
if (result.ok) {
  setRateLimitHeaders(res, result.value);
  if (!result.value.allowed) {
    res.status(429).json({ error: 'too_many_requests', retryAfter: result.value.resetAt });
    return;
  }
}
```

---

## NestJS Integration

Import from the `/nestjs` subpath — NestJS code is tree-shaken from the core bundle.

### Module Setup

```typescript
import { RateLimiterModule } from '@backendkit-labs/rate-limiter/nestjs';

@Module({
  imports: [
    RateLimiterModule.forRoot({
      config: {
        algorithm:       'sliding-window-counter',
        store:           'memory',
        windowMs:        60_000,
        maxRequests:     100,
      },
      globalGuard: true, // registers RateLimiterGuard as APP_GUARD
    }),
  ],
})
export class AppModule {}
```

`RateLimiterModule.forRoot()` provides:
- `RateLimiterGuard` — registered as `APP_GUARD` when `globalGuard: true`
- The configured `IRateLimiter` instance under the `RATE_LIMITER_INSTANCE` token

### Guard — global or per-route

When `globalGuard: true`, every route is protected by the default limiter. Use `@RateLimit()` to override or fine-tune individual routes.

```typescript
import { Controller, Get } from '@nestjs/common';
import { RateLimit } from '@backendkit-labs/rate-limiter/nestjs';

@Controller('api')
export class ApiController {

  // Inherits the global limiter config
  @Get('status')
  status() {
    return { status: 'ok' };
  }

  // Route-specific limit — overrides the global config for this endpoint
  @Get('export')
  @RateLimit({
    algorithm:    'token-bucket',
    store:        'memory',
    bucketSize:   3,
    tokensPerSecond: 0.1, // 1 export every 10 seconds
    keyPrefix:    'export:',
  })
  export() {
    return this.reportService.generate();
  }

  // Disable rate limiting for this route
  @Get('health')
  @RateLimit(null)
  health() {
    return { healthy: true };
  }
}
```

When the limit is exceeded, the guard returns:

```json
HTTP 429 Too Many Requests
Retry-After: 42
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1716321600

{ "error": "too_many_requests", "retryAfter": 1716321642000 }
```

### Decorator — per method

`@RateLimit()` accepts a full `RateLimiterConfig` object (or any algorithm subtype). Each decorated route gets its own `RateLimiter` instance.

```typescript
import { RateLimit, RateLimitOptions } from '@backendkit-labs/rate-limiter/nestjs';

@Controller('payments')
export class PaymentsController {
  @Post()
  @RateLimit({
    algorithm:       'token-bucket',
    store:           'redis',
    redisOptions:    { host: process.env['REDIS_HOST'] },
    bucketSize:      5,
    tokensPerSecond: 1,
    keyPrefix:       'payments:',
    circuitBreaker:  { fallbackToMemory: true },
  })
  charge(@Body() dto: ChargeDto) {
    return this.paymentsService.charge(dto);
  }
}
```

### Async Configuration

Use `forRootAsync` when config comes from `ConfigService` or other injectable providers:

```typescript
import { RateLimiterModule } from '@backendkit-labs/rate-limiter/nestjs';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot(),
    RateLimiterModule.forRootAsync({
      imports:    [ConfigModule],
      inject:     [ConfigService],
      useFactory: (config: ConfigService) => ({
        algorithm:   'sliding-window-counter',
        store:       'redis',
        redisOptions: {
          host:     config.get<string>('REDIS_HOST', '127.0.0.1'),
          port:     config.get<number>('REDIS_PORT', 6379),
          password: config.get<string>('REDIS_PASSWORD'),
        },
        windowMs:    config.get<number>('RATE_LIMIT_WINDOW_MS', 60_000),
        maxRequests: config.get<number>('RATE_LIMIT_MAX_REQUESTS', 100),
        circuitBreaker: { fallbackToMemory: true },
      }),
      globalGuard: true,
    }),
  ],
})
export class AppModule {}
```

**Note — IP-based rate limiting behind a proxy:** When using the default key generator (based on `request.ip`), configure Express trust proxy in `main.ts` if your app runs behind a reverse proxy:

```typescript
const app = await NestFactory.create(AppModule);
app.set('trust proxy', 1); // trust one proxy hop (Nginx, ALB, Cloudflare, etc.)
```

Without this, all clients behind the same proxy share a single rate limit key because `request.ip` returns the proxy's IP.

---

## TypeScript Configuration

### Subpath exports (`/nestjs`)

This package uses the `exports` field in `package.json`. TypeScript's ability to resolve the `/nestjs` subpath depends on `moduleResolution`:

**Modern resolution (recommended) — no extra config needed:**

```json
{
  "compilerOptions": {
    "moduleResolution": "bundler"
  }
}
```

`"bundler"`, `"node16"`, and `"nodenext"` all understand the `exports` field natively.

**Legacy resolution (`"node"`) — add a `paths` alias:**

```json
{
  "compilerOptions": {
    "moduleResolution": "node",
    "paths": {
      "@backendkit-labs/rate-limiter/nestjs": [
        "./node_modules/@backendkit-labs/rate-limiter/dist/nestjs/index"
      ]
    }
  }
}
```

### NestJS decorator support

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

---

## Architecture

```
@backendkit-labs/rate-limiter          (core — zero framework dependencies)
  RateLimiterFactory                   single-call factory, infers algorithm + store
  RateLimiter                          consume() / check() / reset() / resetAll()
  MemoryStore                          in-process store, zero dependencies
  RedisStore                           atomic Lua scripts, ioredis single/cluster
  TokenBucketAlgorithm                 smooth bursts, O(1) state
  FixedWindowAlgorithm                 hard cap per window, O(1) state
  SlidingWindowLogAlgorithm            exact sliding, O(maxRequests) state
  SlidingWindowCounterAlgorithm        approximate sliding, O(1) state

@backendkit-labs/rate-limiter/nestjs  (optional NestJS layer)
  RateLimiterModule                    forRoot() / forRootAsync()
  RateLimiterGuard                     APP_GUARD — returns 429 with Retry-After
  @RateLimit()                         per-route config override or disable
```

The core is a pure TypeScript library with a single runtime dependency (`@backendkit-labs/result`). `ioredis`, `@backendkit-labs/circuit-breaker`, and NestJS are all optional peer dependencies — none are loaded unless you explicitly use them.

---

## License

Apache-2.0 — [BackendKit Labs](https://github.com/BackendKit-labs)
