---
layout: home

hero:
  name: "BackendKit Labs"
  text: "Composable resilience for Node.js backends"
  tagline: "Explicit errors. Adaptive retries. Observable failures. 7 packages that compose into a coherent system — not just isolated utilities. Built from production experience with distributed systems. Community in early formation, your use cases shape the roadmap."
  image:
    src: /logo.svg
    alt: BackendKit Labs
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/BackendKit-labs/backendkit-monorepo

features:
  - icon: 🧠
    title: Auto-Learning
    details: The only Node.js resilience toolkit that tunes itself. Monitors real traffic patterns and automatically adjusts circuit breaker thresholds, bulkhead concurrency limits, and HTTP client timeouts — no manual tweaking required.
    link: /packages/auto-learning
    linkText: Explore Auto-Learning
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
  - icon: 🌐
    title: HTTP Client
    details: Production-grade HTTP client on axios. Every call returns Result<T,E> — no try/catch. Built-in circuit breaker, retry with jitter, request cancellation, and pre-request pipeline middleware.
    link: /packages/http-client
    linkText: Explore HTTP Client
  - icon: 🔗
    title: Pipeline
    details: Chain of Responsibility pattern for async middleware. Steps transform context and return typed results — stop-on-first or collect-all error modes, conditional steps, observability hooks.
    link: /packages/pipeline
    linkText: Explore Pipeline
  - icon: 🔭
    title: Observability
    details: Structured logging, metrics shipping, correlation ID propagation via AsyncLocalStorage, and optional OpenTelemetry spans — all for NestJS.
    link: /packages/observability
    linkText: Explore Observability
  - icon: 🔥
    title: Request Scanner
    details: WAF for Node.js with 23 built-in rules across 6 attack categories — SQLi, XSS, Path Traversal, Command Injection, NoSQL Injection, SSRF. Framework-agnostic core + NestJS middleware and pipe.
    link: /packages/request-scanner
    linkText: Explore Request Scanner
  - icon: 🎬
    title: Console Animations
    details: 17 built-in terminal animations for Node.js CLIs — spinners, progress bars, visual effects. CI-aware, zero runtime dependencies.
    link: /packages/console-animations
    linkText: Explore Console Animations
---
