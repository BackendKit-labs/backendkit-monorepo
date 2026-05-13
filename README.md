# BackendKit Monorepo

Reusable, enterprise-grade Node.js libraries by [BackendKit Labs](https://github.com/backendkit-dev).

## Packages

| Package | Version | Description |
|---------|---------|-------------|
| [`@backendkit-labs/console-animations`](./packages/console-animations) | 0.1.2 | Terminal animations for Node.js CLI applications |
| [`@backendkit-labs/bulkhead`](./packages/bulkhead) | 0.1.0 | Bulkhead concurrency limiting — framework-agnostic core + NestJS integration |
| [`@backendkit-labs/circuit-breaker`](./packages/circuit-breaker) | 0.1.0 | Circuit Breaker with business vs infrastructure error classification + NestJS integration |
| [`@backendkit-labs/result`](./packages/result) | 0.1.1 | Type-safe Result monad — generic errors, observability, resilience, Flow pipeline + NestJS integration |
| [`@backendkit-labs/observability`](./packages/observability) | 0.1.0 | Structured logging, metrics, correlation ID propagation, performance interceptors, and exception handling for NestJS — optional OTel support |

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

MIT
