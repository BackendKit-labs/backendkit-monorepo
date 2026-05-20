# BackendKit Labs

Composable building blocks for resilient Node.js backends — built from production experience with distributed systems.

**11 focused packages · Install only what you need · Zero runtime deps (core) · 100% TypeScript**

> Community in early formation. Your use cases shape the roadmap — open an issue, start a discussion.

---

## Why BackendKit?

Installing `neverthrow` + `opossum` + `p-retry` + a logger gets you pieces. BackendKit gives you a coherent system where `Result`, circuit breaker, idempotency, pipeline, and observability speak the same language — and `auto-learning` tunes them automatically based on real traffic.

---

## Packages

### Resilience

| Package | Version | Description |
|---------|---------|-------------|
| [`@backendkit-labs/circuit-breaker`](./packages/circuit-breaker) | [![npm](https://img.shields.io/npm/v/@backendkit-labs/circuit-breaker?style=flat-square&color=cb3837)](https://www.npmjs.com/package/@backendkit-labs/circuit-breaker) | Circuit Breaker — fail-fast with business vs infrastructure error classification, optional NestJS integration |
| [`@backendkit-labs/bulkhead`](./packages/bulkhead) | [![npm](https://img.shields.io/npm/v/@backendkit-labs/bulkhead?style=flat-square&color=cb3837)](https://www.npmjs.com/package/@backendkit-labs/bulkhead) | Bulkhead concurrency limiting — queue-based, optional NestJS integration |
| [`@backendkit-labs/retry`](./packages/retry) | [![npm](https://img.shields.io/npm/v/@backendkit-labs/retry?style=flat-square&color=cb3837)](https://www.npmjs.com/package/@backendkit-labs/retry) | Retry with exponential backoff — sliding-window budget, idempotency, error classification, duck-typed circuit-breaker/bulkhead/observability integration, optional NestJS support |
| [`@backendkit-labs/idempotency`](./packages/idempotency) | [![npm](https://img.shields.io/npm/v/@backendkit-labs/idempotency?style=flat-square&color=cb3837)](https://www.npmjs.com/package/@backendkit-labs/idempotency) | Idempotency key enforcement — replay cached responses, prevent duplicate mutations, pluggable store (in-memory / Redis) |
| [`@backendkit-labs/auto-learning`](./packages/auto-learning) | [![npm](https://img.shields.io/npm/v/@backendkit-labs/auto-learning?style=flat-square&color=cb3837)](https://www.npmjs.com/package/@backendkit-labs/auto-learning) | Adaptive resilience — automatically tunes circuit breakers, bulkheads, and HTTP clients based on real traffic patterns |

### HTTP & Networking

| Package | Version | Description |
|---------|---------|-------------|
| [`@backendkit-labs/http-client`](./packages/http-client) | [![npm](https://img.shields.io/npm/v/@backendkit-labs/http-client?style=flat-square&color=cb3837)](https://www.npmjs.com/package/@backendkit-labs/http-client) | Production-grade HTTP client — axios + circuit breaker + retry + Result responses + cancellation + NestJS integration |
| [`@backendkit-labs/request-scanner`](./packages/request-scanner) | [![GitHub Packages](https://img.shields.io/badge/github%20packages-v0.3.0-2ea44f?style=flat-square&logo=github)](https://github.com/BackendKit-labs/backendkit-monorepo/pkgs/npm/request-scanner) | Web Application Firewall — SQLi, XSS, Path Traversal, Command Injection, NoSQL Injection, SSRF detection + NestJS integration · Published to **GitHub Packages** |

### Observability

| Package | Version | Description |
|---------|---------|-------------|
| [`@backendkit-labs/observability`](./packages/observability) | [![npm](https://img.shields.io/npm/v/@backendkit-labs/observability?style=flat-square&color=cb3837)](https://www.npmjs.com/package/@backendkit-labs/observability) | Structured logging, metrics, correlation ID propagation, performance interceptors, and exception handling for NestJS — optional OTel support |

### Utilities

| Package | Version | Description |
|---------|---------|-------------|
| [`@backendkit-labs/result`](./packages/result) | [![npm](https://img.shields.io/npm/v/@backendkit-labs/result?style=flat-square&color=cb3837)](https://www.npmjs.com/package/@backendkit-labs/result) | Type-safe Result monad — explicit errors, resilience combinators, Flow pipeline + NestJS integration |
| [`@backendkit-labs/pipeline`](./packages/pipeline) | [![npm](https://img.shields.io/npm/v/@backendkit-labs/pipeline?style=flat-square&color=cb3837)](https://www.npmjs.com/package/@backendkit-labs/pipeline) | Type-safe async pipeline (Chain of Responsibility) — stop-on-first / collect-all modes, conditional steps, observability hooks + NestJS integration |
| [`@backendkit-labs/console-animations`](./packages/console-animations) | [![npm](https://img.shields.io/npm/v/@backendkit-labs/console-animations?style=flat-square&color=cb3837)](https://www.npmjs.com/package/@backendkit-labs/console-animations) | Terminal animations for Node.js CLI applications |

---

## Examples

### Minimal examples — one file, one concept

Each example installs its own dependencies from npm and runs with `npm start`. No NestJS, no boilerplate — just the library and a realistic scenario.

| Example | Library | What it shows |
|---------|---------|---------------|
| [`examples/minimal-result`](./examples/minimal-result) | `@backendkit-labs/result` | `Result<T, E>` vs `try/catch` — typed errors, `match()`, no surprises |
| [`examples/minimal-retry`](./examples/minimal-retry) | `@backendkit-labs/retry` | Retry a flaky payment — exponential backoff, jitter, lifecycle hooks |
| [`examples/minimal-circuit-breaker`](./examples/minimal-circuit-breaker) | `@backendkit-labs/circuit-breaker` | `CLOSED → OPEN → HALF_OPEN → CLOSED` lifecycle with a real state change log |
| [`examples/minimal-bulkhead`](./examples/minimal-bulkhead) | `@backendkit-labs/bulkhead` | `Promise.all` (16 concurrent) vs bulkhead (max 3) — side by side |
| [`examples/minimal-pipeline`](./examples/minimal-pipeline) | `@backendkit-labs/pipeline` | 3-step order pipeline — validate → charge → ship, `stop-on-first` mode |

```bash
# Pick any example and run it
cd examples/minimal-retry
npm install && npm start
```

### Full showcase — all libraries together

[`examples/shopify-backend`](./examples/shopify-backend) is a production-grade NestJS backend that integrates every BackendKit library simultaneously — circuit breakers, bulkheads, retry, idempotency, pipeline, observability, WAF, and auto-learning. Includes 6 k6 stress test scenarios.

```bash
# Requires monorepo (request-scanner is on GitHub Packages, not npm)
npm run build --workspace=packages/request-scanner
cd examples/shopify-backend && npm install && npm run start:dev
```

---

## Benchmarks

Transparent performance comparisons against popular alternatives — run on your own hardware with `npm run bench` from the monorepo root:

- **Circuit Breaker vs opossum** — BackendKit uses an `AsyncMutex` for safe concurrent state transitions. opossum is ~42× faster in CLOSED state; the mutex adds ~120 µs per call — negligible for any I/O-bound workload (database calls, HTTP).
- **Result vs neverthrow** — construction and `map`/`flatMap` chains are statistically identical. `fail()` is 20% faster than `try/catch` on the error path (no stack capture).
- **Result vs try/catch** — within 5% on the success path.

→ [Full benchmark results with methodology](./benchmarks/README.md)

---

## Development

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Run all tests
npm test

# Type check
npm run typecheck

# Lint
npm run lint
```

---

## Contributing

Issues, questions, and PRs are welcome — especially real use cases that expose gaps in the current design. See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full guide.

- **[GitHub Discussions](https://github.com/BackendKit-labs/backendkit-monorepo/discussions)** — questions, ideas, and show & tell
- **[Open issues](https://github.com/BackendKit-labs/backendkit-monorepo/issues)** — bugs and tasks, including `good first issue` picks

---

## Maintainer

**[Mairon Cuello](https://www.linkedin.com/in/maironcuellomartinez/)** — Backend engineer with experience building distributed systems and resilient Node.js services. BackendKit is a distillation of patterns I've used in production over the years.

Open to feedback, war stories, and collaboration — open a [Discussion](https://github.com/BackendKit-labs/backendkit-monorepo/discussions) or reach out on LinkedIn.

---

## License

Apache-2.0 — [BackendKit Labs](https://github.com/BackendKit-labs)
