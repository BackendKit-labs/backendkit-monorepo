---
layout: home

hero:
  name: "BackendKit Labs"
  text: "Enterprise-grade Node.js libraries"
  tagline: Battle-tested, composable building blocks for production backends. Framework-agnostic cores with optional NestJS integration.
  image:
    src: /logo.svg
    alt: BackendKit Labs
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/backendkit-dev/backendkit-monorepo

features:
  - icon: 🎯
    title: Result Monad
    details: Type-safe error handling. Replace try/catch with composable transformations, resilience primitives (retry, backoff, jitter, timeout), and NestJS integration. Zero runtime dependencies.
    link: /packages/result
    linkText: Explore Result
  - icon: ⚡
    title: Circuit Breaker
    details: Sliding-window circuit breaker with business vs infrastructure error classification. Stops cascading failures before they take your service down.
    link: /packages/circuit-breaker
    linkText: Explore Circuit Breaker
  - icon: 🛡️
    title: Bulkhead
    details: Concurrency limiting inspired by Resilience4j. Isolates failures and prevents resource exhaustion — framework-agnostic core with NestJS guard, interceptor, and middleware.
    link: /packages/bulkhead
    linkText: Explore Bulkhead
  - icon: 🔭
    title: Observability
    details: Structured logging, metrics shipping, correlation ID propagation via AsyncLocalStorage, and optional OpenTelemetry spans — all for NestJS.
    link: /packages/observability
    linkText: Explore Observability
  - icon: 🎬
    title: Console Animations
    details: 17 built-in terminal animations for Node.js CLIs — spinners, progress bars, visual effects. CI-aware, zero runtime dependencies.
    link: /packages/console-animations
    linkText: Explore Console Animations
---
