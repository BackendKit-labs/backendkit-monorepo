---
title: Getting Started
description: Introduction to BackendKit Labs — reusable, enterprise-grade Node.js libraries.
---

# Getting Started

BackendKit Labs is a monorepo of production-ready Node.js libraries. Every package ships with a framework-agnostic TypeScript core and an optional NestJS integration layer — so you can adopt as much or as little as you need.

## Design philosophy

**Composable over monolithic.** Each package solves one problem and solves it well. You can use `@backendkit-labs/result` without `@backendkit-labs/circuit-breaker`, or combine them freely.

**Framework-agnostic core.** The core of every package has zero runtime dependencies and works in any Node.js project. NestJS bindings (modules, guards, interceptors, decorators) live in a separate `/nestjs` subpath export and are tree-shaken from the core bundle.

**Types first.** TypeScript is not an afterthought. Every API is designed to make the type system guide you toward correct usage.

## Packages

| Package | Version | Description |
|---------|---------|-------------|
| [`@backendkit-labs/result`](/packages/result) | `0.1.1` | Type-safe Result monad — generic errors, composable transformations, resilience, NestJS integration |
| [`@backendkit-labs/circuit-breaker`](/packages/circuit-breaker) | `0.1.0` | Sliding-window circuit breaker with business vs infrastructure error classification |
| [`@backendkit-labs/bulkhead`](/packages/bulkhead) | `0.1.0` | Concurrency limiting — framework-agnostic core + NestJS guard, interceptor, middleware |
| [`@backendkit-labs/observability`](/packages/observability) | `0.1.0` | Structured logging, metrics, correlation ID propagation, OTel support for NestJS |
| [`@backendkit-labs/pipeline`](/packages/pipeline) | `0.1.0` | Type-safe async pipeline (Chain of Responsibility) — stop-on-first / collect-all, conditional steps, NestJS integration |
| [`@backendkit-labs/http-client`](/packages/http-client) | `0.1.0` | Production-grade HTTP client — axios + circuit breaker + retry + Result responses + pipeline middleware + NestJS integration |
| [`@backendkit-labs/request-firewall`](/packages/request-firewall) | `0.1.3` | Web Application Firewall — 23 built-in rules, SQLi / XSS / Path Traversal / NoSQL / SSRF + NestJS integration |
| [`@backendkit-labs/console-animations`](/packages/console-animations) | `0.1.2` | Terminal animations for Node.js CLI applications |

## Choosing a package

**Start with `result` if** your codebase uses `try/catch` everywhere and errors are invisible in function signatures. It unlocks a composable, type-safe error handling model that works with anything.

**Add `circuit-breaker` if** you call external dependencies (APIs, databases, third-party services). It prevents a slow or failing dependency from taking your entire service down.

**Add `bulkhead` if** you need to protect a shared resource (DB connection pool, external API rate limit) from being overwhelmed by concurrent requests.

**Add `observability` if** you're building a NestJS service and want structured logging, request correlation, metrics, and performance tracing configured in a single `forRoot()` call.

**Add `pipeline` if** you need composable, typed middleware chains — pre-request auth, validation, transformation — with stop-on-first or collect-all error semantics.

**Add `http-client` if** you make outbound HTTP calls and want circuit breaker, retry, and typed errors without try/catch.

**Add `request-firewall` if** you need WAF-level protection against SQLi, XSS, and other injection attacks at the request boundary.

**Add `console-animations` if** you're building a CLI tool and want professional terminal animations with CI detection baked in.

## Installation

Each package is independent. Install only what you need:

```bash
# Core resilience primitives
npm install @backendkit-labs/result
npm install @backendkit-labs/circuit-breaker
npm install @backendkit-labs/bulkhead

# Middleware and HTTP
npm install @backendkit-labs/pipeline
npm install @backendkit-labs/http-client axios

# Security
npm install @backendkit-labs/request-firewall

# NestJS observability stack
npm install @backendkit-labs/observability

# CLI tools
npm install @backendkit-labs/console-animations
```

For NestJS subpath exports, you also need the peer dependencies:

```bash
npm install @nestjs/common @nestjs/core rxjs
```

## Combining packages

The libraries are designed to work together. A typical NestJS service might use all of them:

```typescript
// app.module.ts
import { Module }              from '@nestjs/common';
import { CircuitBreakerModule } from '@backendkit-labs/circuit-breaker/nestjs';
import { BulkheadModule }       from '@backendkit-labs/bulkhead/nestjs';
import { ResultModule }         from '@backendkit-labs/result/nestjs';
import { ObservabilityModule }  from '@backendkit-labs/observability';

@Module({
  imports: [
    ObservabilityModule.forRoot({ serviceName: 'my-api', environment: 'production' }),
    CircuitBreakerModule,
    BulkheadModule,
    ResultModule,
  ],
})
export class AppModule {}
```

A service layer using `result` + `circuit-breaker` together:

```typescript
@Injectable()
export class PaymentService {
  private readonly cb = new CircuitBreaker({
    name:             'stripe',
    failureThreshold: 40,
    isFailure:        isHttpServerError,
  });

  @WithMetrics({ operation: 'payment.charge', tags: ['stripe'] })
  async charge(dto: ChargeDto): Promise<RichResult<Payment, PaymentError>> {
    return track(
      () => this.cb.execute(() => this.stripe.charges.create(dto)),
      { operation: 'stripe.charge' },
    );
  }
}
```

## Source code

All packages live in the [`backendkit-dev/backendkit-monorepo`](https://github.com/backendkit-dev/backendkit-monorepo) repository on GitHub.

```
backendkit-monorepo/
├── packages/
│   ├── result/
│   ├── circuit-breaker/
│   ├── bulkhead/
│   ├── observability/
│   ├── pipeline/
│   ├── http-client/
│   ├── request-firewall/
│   └── console-animations/
└── apps/
    └── docs/          ← you are here
```
