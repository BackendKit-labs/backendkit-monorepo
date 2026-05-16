# BackendKit Monorepo

Reusable, enterprise-grade Node.js libraries by [BackendKit Labs](https://github.com/BackendKit-labs).

## Packages

| Package | Version | Description |
|---------|---------|-------------|
| [`@backendkit-labs/console-animations`](./packages/console-animations) | 0.1.2 | Terminal animations for Node.js CLI applications |
| [`@backendkit-labs/bulkhead`](./packages/bulkhead) | 0.1.0 | Bulkhead concurrency limiting — framework-agnostic core + NestJS integration |
| [`@backendkit-labs/circuit-breaker`](./packages/circuit-breaker) | 0.1.0 | Circuit Breaker with business vs infrastructure error classification + NestJS integration |
| [`@backendkit-labs/result`](./packages/result) | 0.1.1 | Type-safe Result monad — generic errors, observability, resilience, Flow pipeline + NestJS integration |
| [`@backendkit-labs/observability`](./packages/observability) | 0.1.0 | Structured logging, metrics, correlation ID propagation, performance interceptors, and exception handling for NestJS — optional OTel support |
| [`@backendkit-labs/request-scanner`](./packages/request-scanner) | 0.1.5 | Web Application Firewall — SQLi, XSS, Path Traversal, Command Injection, NoSQL Injection, SSRF detection + NestJS integration |
| [`@backendkit-labs/pipeline`](./packages/pipeline) | 0.1.0 | Type-safe async pipeline (Chain of Responsibility) — stop-on-first / collect-all modes, conditional steps, observability hooks + NestJS integration |
| [`@backendkit-labs/http-client`](./packages/http-client) | 0.1.0 | Production-grade HTTP client — axios + circuit breaker + retry + Result responses + cancellation + pipeline middleware + NestJS integration |

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

## License

Apache-2.0
