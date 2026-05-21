# Changelog

All notable changes to `@backendkit-labs/rate-limiter` will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.0] — 2026-05-21

### Added

- **Token Bucket** algorithm — smooth burst allowance with configurable `bucketSize` and `tokensPerSecond`
- **Fixed Window** algorithm — hard request cap per fixed time window (`windowMs`, `maxRequests`)
- **Sliding Window Log** algorithm — per-request timestamp log for precise sliding enforcement
- **Sliding Window Counter** algorithm — memory-efficient hybrid with configurable sub-window granularity
- **MemoryStore** — zero-dependency in-process store; ready out of the box
- **RedisStore** — atomic Lua scripts via `EVALSHA`/`EVAL` with NOSCRIPT fallback; supports `ioredis` single-node and Cluster
- **Circuit breaker integration** — optional `@backendkit-labs/circuit-breaker` support on `RedisStore` with `fallbackToMemory: true`
- **`RateLimiterFactory.create(config)`** — single-call factory; infers algorithm and store from a typed config object
- **`RateLimiter` class** — low-level composable class: `consume(key)`, `reset(key)`, `status(key)`
- **`RateLimitResult`** — rich result shape: `allowed`, `remaining`, `resetAt`, `retryAfter`, `limit`, `key`
- **Standard rate limit headers** — `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After`
- **NestJS integration** (`/nestjs` subpath):
  - `RateLimiterModule.forRoot()` / `RateLimiterModule.forRootAsync()`
  - `@RateLimit()` decorator for controller methods
  - `RateLimiterGuard` — returns `429 Too Many Requests` with `Retry-After`
- **k6 load test suite** (`examples/rate-limiter-k6`):
  - Smoke test — baseline correctness, single VU, 40 iterations
  - Load test — 5 VU steady traffic, 30s, endpoint rotation
  - Burst test — spike to 50 VUs, validates fail-fast behaviour and recovery
- **133 unit tests** covering all four algorithms × both stores, edge cases, and error paths
- Dual ESM + CJS build via `tsup` with declaration files and source maps
- `"node": ">=18"` minimum engine requirement
