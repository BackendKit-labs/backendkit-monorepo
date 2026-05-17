---
title: Blog
description: Technical writing on resilience, error handling, and distributed systems patterns in Node.js.
---

# Blog

Technical writing on resilience, error handling, and distributed systems patterns — the problems that shaped BackendKit.

---

### [From try/catch to explicit errors: a practical migration guide](/blog/try-catch-to-result)
*May 2026 · 8 min read*

`try/catch` makes errors invisible. This guide shows how to migrate incrementally to `Result<T, E>` — starting at the boundaries, without rewriting your entire codebase at once.

---

### [Circuit breaker patterns in Node.js — and why business errors shouldn't trip yours](/blog/circuit-breaker-business-errors)
*May 2026 · 7 min read*

Most circuit breaker implementations treat all errors equally. That's wrong. A 404 Not Found is not the same as a timeout. Here's why the distinction matters and how to get it right.

---

### [Why we built our own Result type (and what we learned from neverthrow)](/blog/why-result)
*May 2026 · 6 min read*

`neverthrow` is excellent. We still built our own. Here's what we needed that wasn't there — and the honest tradeoffs of both approaches.

---

Questions or ideas for future posts? [Start a Discussion](https://github.com/BackendKit-labs/backendkit-monorepo/discussions).
