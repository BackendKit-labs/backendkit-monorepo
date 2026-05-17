# BackendKit Labs

Composable building blocks for resilient Node.js backends — built from production experience with distributed systems.

**7 focused packages · Install only what you need · Zero runtime deps (core) · 100% TypeScript**

> Community in early formation. Your use cases shape the roadmap — open an issue, start a discussion.

---

## Why BackendKit?

Installing `neverthrow` + `opossum` + `p-retry` + a logger gets you pieces. BackendKit gives you a coherent system where `Result`, circuit breaker, retry, pipeline, and observability speak the same language — and `auto-learning` tunes them automatically based on real traffic.

---

## Packages

### Resilience

| Package | Version | Description |
|---------|---------|-------------|
| [`@backendkit-labs/circuit-breaker`](./packages/circuit-breaker) | [![npm](https://img.shields.io/npm/v/@backendkit-labs/circuit-breaker?style=flat-square&color=cb3837)](https://www.npmjs.com/package/@backendkit-labs/circuit-breaker) | Circuit Breaker — fail-fast with business vs infrastructure error classification, optional NestJS integration |
| [`@backendkit-labs/bulkhead`](./packages/bulkhead) | [![npm](https://img.shields.io/npm/v/@backendkit-labs/bulkhead?style=flat-square&color=cb3837)](https://www.npmjs.com/package/@backendkit-labs/bulkhead) | Bulkhead concurrency limiting — queue-based, optional NestJS integration |
| [`@backendkit-labs/auto-learning`](./packages/auto-learning) | [![npm](https://img.shields.io/npm/v/@backendkit-labs/auto-learning?style=flat-square&color=cb3837)](https://www.npmjs.com/package/@backendkit-labs/auto-learning) | Adaptive resilience — automatically tunes circuit breakers, bulkheads, and HTTP clients based on real traffic patterns |

### HTTP & Networking

| Package | Version | Description |
|---------|---------|-------------|
| [`@backendkit-labs/http-client`](./packages/http-client) | [![npm](https://img.shields.io/npm/v/@backendkit-labs/http-client?style=flat-square&color=cb3837)](https://www.npmjs.com/package/@backendkit-labs/http-client) | Production-grade HTTP client — axios + circuit breaker + retry + Result responses + cancellation + NestJS integration |
| [`@backendkit-labs/request-scanner`](./packages/request-scanner) | [![npm](https://img.shields.io/npm/v/@backendkit-labs/request-scanner?style=flat-square&color=cb3837)](https://www.npmjs.com/package/@backendkit-labs/request-scanner) | Web Application Firewall — SQLi, XSS, Path Traversal, Command Injection, NoSQL Injection, SSRF detection + NestJS integration |

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

## License

Apache-2.0 — [BackendKit Labs](https://github.com/BackendKit-labs)
