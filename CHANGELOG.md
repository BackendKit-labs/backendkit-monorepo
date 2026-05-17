# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

---

## [2026-05-17] -- `@backendkit-labs/request-scanner` v0.3.0

### Fixed

- **`pickWorst` logic duplicated** — extracted to `core/utils.ts` and shared by `WafMiddleware` and `SanitizePipe`. Both blocking paths now use the same implementation.
- **Inconsistent error shapes between middleware and pipe** — unified to `{ ok, message, code, ruleId, location, field }`:
  - Middleware 403 now includes `field` (which field triggered the worst threat).
  - Pipe 400 now includes `ok: false` and `location` (the scanned target).
- **`WAF_OPTIONS` not exported from `WafModule`** — added to `exports[]` so consuming modules can inject the options token directly.
- **JSDoc referenced old package name** — updated `WafModule` example from `@backendkit-labs/http-shield/nestjs` to `@backendkit-labs/request-scanner/nestjs`.

### Added

- **`RequestScanner*` aliases** — `RequestScannerModule`, `RequestScannerMiddleware`, `RequestScannerPipe`, `RequestScannerOptions`, `REQUEST_SCANNER_OPTIONS` exported from `@backendkit-labs/request-scanner/nestjs`. The `Waf*` names remain for backwards compatibility.
- 3 new tests for the `pickWorst` utility (severity ordering, tie-breaking, non-mutation).

---

## [2026-05-17] -- `@backendkit-labs/request-scanner` v0.2.0

### Fixed

- **SQL block-comment bypass (`sqli-002`, `sqli-003`, `sqli-004`)** — patterns now use a `WS` helper that matches `\s` or `/*...*/` SQL block-comments as whitespace separators. Inputs like `UNION/**/SELECT`, `DROP/**/TABLE`, and `;/**/DELETE` are now detected. A `WS0` (zero-or-more) variant is used for `sqli-004` which originally used `\s*`.
- **SSRF via hex-encoded IP (`ssrf-004`)** — new rule detects `http://0x7f000001/` style requests (disabled by default like all SSRF rules; enable with `rules: { ssrf: true }`).
- **SSRF via IPv6 loopback/mapped addresses (`ssrf-005`)** — new rule detects `http://[::1]/` and `http://[::ffff:127.0.0.1]/` style requests (disabled by default).
- **`customRules` global-flag validation** — `WafScanner` constructor now throws immediately if any custom rule's `pattern` has the `global` flag set, surfacing the bug at configuration time rather than silently producing alternating false negatives at request time.
- **`log` vs `monitor` mode distinction** — `log` mode now emits detected threats to `console.warn` in addition to calling `onThreat`. `monitor` mode remains silent (only `onThreat` fires). Previously both modes behaved identically.

### Added

- 13 new tests: SQL comment bypass coverage for `sqli-002/003/004`, SSRF hex/IPv6 coverage for `ssrf-004/005`, and `customRules` global-flag validation.

---

## [2026-05-17] -- `@backendkit-labs/request-scanner` v0.1.7

### Fixed

- **`xss-002` false positives on common query params** — `\bon\w+\s*=` was replaced with a two-branch pattern: any `on*=` inside an explicit HTML tag (`<[^>]*\bon\w+=`), OR a curated list of known HTML event names for standalone cases. Params like `online=`, `once=`, `onlyMe=`, `oneTime=` no longer trigger a 403.
- **`sqli-001` false positives on quoted English text** — the first branch `(?:'|")\s*(?:OR|AND)\s+` was tightened to require a SQL expression after `OR/AND` (`\d+=`, `'str'=`, `NULL`, `TRUE`, `FALSE`, `col=`). Text like `"Or maybe later"` and `"And one more thing"` no longer trigger.
- **`cmd-002` false positives on markdown inline code** — the backtick branch now requires the content to start with a known shell binary (same list as `cmd-001`). Inline code like `` `useState` `` or `` `npm install` `` no longer triggers. The `$(...)` branch is unchanged.
- **`sqli-007` false positives on URL fragments** — `#` is narrowed with `(?=\s|$)` so `'https://example.com#section'` no longer triggers. MySQL `#` comments followed by a word character (e.g., `1'#nospace`) are an accepted false negative documented in code.

### Added

- 26 new tests: must-pass benign inputs for all four fixed rules + must-detect regression coverage to guard against future regressions.

---

## [2026-05-17] -- `@backendkit-labs/request-scanner` v0.1.6

### Fixed

- **`excludePaths` over-matching** -- `startsWith` was replaced with an exact-or-prefix-segment check (`path === p || path.startsWith(p + '/')`). Previously, excluding `/api` also excluded `/api-admin` and `/api-secret`, creating a WAF bypass vector for any attacker who knew an excluded path prefix.
- **`rules: { category: undefined }` disabling category** -- passing `undefined` as an override value now falls back to the rule's own `enabled` default instead of being coerced to falsy. Previously, `new WafScanner({ rules: { sqli: undefined } })` silently disabled all SQLi detection.
- **Memory DoS via large strings** -- strings are now truncated to `maxStringLength` inside `extractStrings()` before being stored. Previously the full string was held in the `fields[]` array regardless of size; truncation only applied to the regex test input.
- **`Buffer` byte-by-byte recursion** -- `extractStrings` now returns early on `Buffer.isBuffer(data)`. Previously, passing a `Buffer` caused `Object.entries()` to enumerate every byte as a separate indexed key, generating one recursion per byte.
- **`SanitizePipe` mutated `threats` array via `.sort()`** -- fixed to use `slice().sort()` matching the already-correct behavior in `WafMiddleware`.

---

## [2026-05-17] -- `@backendkit-labs/bulkhead` and `@backendkit-labs/circuit-breaker` v0.2.0

### Fixed

#### `@backendkit-labs/bulkhead` v0.2.0

- **Queue timeout race** -- the timeout handler now only rejects and increments `timedOutCalls` when the item is still in the queue; spurious fires after `processQueue` dequeues the item are now no-ops.
- **`processQueue`** -- clears each entry's `timeoutId` immediately on dequeue, preventing the timer from firing against a task that is already running.
- **`HttpBulkheadMiddleware`** -- validates `parseInt` results with `Number.isNaN` and falls back to safe defaults, preventing `NaN` concurrency/queue limits from silently corrupting all bulkhead comparisons.

#### `@backendkit-labs/circuit-breaker` v0.2.0

- **Config validation** -- `CircuitBreaker` constructor and `updateConfig` now validate all numeric fields: `failureThreshold` / `slowCallThreshold` (0–100), `slidingWindowSize`, `minimumCalls`, `halfOpenMaxCalls`, `openTimeoutMs`, `slowCallDurationMs` (≥1). Invalid values previously caused silent `NaN` in failure-rate calculations.
- **Redundant `syncState`** -- removed the duplicate `syncState()` call at the top of `execute()`; `canAttempt()` already calls it, so it was running twice per request.

---

## [2026-05-17] -- `@backendkit-labs/auto-learning` v0.2.0

### Fixed

#### `@backendkit-labs/auto-learning` v0.2.0

**Sprint 1 — Critical bugs**
- **`FeedbackLoop`** -- `previousConfig` was captured after `tune()` instead of before, so `configChanges` diff was always empty `{}`.
- **`AutoLearningInterceptor`** -- replaced `tap()` with `tap({next, error})` so patterns are recorded on the error path too; skips non-HTTP execution contexts.
- **`AnomalyDetector`** -- inverted `error_rate` logic: now alerts when a 5xx arrives at an endpoint whose baseline `errorRate` is below the threshold (healthy endpoint). Previous logic was backwards.
- **`AnomalyDetector`** -- deduplicated `unknown_endpoint` reports per `method:path` via a `seenUnknown` Set so N patterns for the same new endpoint produce exactly 1 anomaly instead of N.

**Sprint 2 — Bounded storage & memory safety**
- **`InMemoryStorage`** -- added FIFO eviction caps (`maxPatterns` / `maxAnomalies` / `maxCycles`) to prevent unbounded memory growth.
- **`InMemoryStorage`** -- fixed `getAggregates` grouping key to use `\x00` separator so parameterized paths like `/users/:id` are preserved correctly.
- **`PatternRegistry.getStats`** -- replaced `Math.min/max` spread with an explicit loop to avoid `RangeError` on large arrays (>~10k elements).
- **`FeedbackLoop.start`** -- guarded async `setInterval` callback with an `isProcessing` mutex to prevent overlapping cycles.
- **`AutoLearningInterceptor`** -- strips query string from `req.url` so cardinality is bounded to route templates.
- Exported `InMemoryStorageLimits` type from the package root.

**Sprint 3 — Lifecycle & consistency**
- **`ConfigTuner`** -- added `cooldownMs` to `ConfigTunerConfig` (replaces hardcoded 60 000 ms); extracted `computeNext` and `diffSections` private helpers.
- **`FeedbackLoop` / `ConfigTuner`** -- `onCycle` / `onConfigChange` now return an `() => void` unsubscribe function.
- **`AutoLearningAdaptersService`** -- implements `OnApplicationBootstrap` (starts loop) and `OnModuleDestroy` (stops loop, unsubscribes config listener); `autoStart: false` opt-out available.
- **`FeedbackLoop.runOnce`** -- captures a single `windowEnd` timestamp passed to both `getPatterns` and `getAggregates` so both steps use the same window boundary.
- **`FeedbackLoop`** -- logs a warning when `saveAnomaly` fails instead of silently discarding the `Result`.

**Sprint 4 — API improvements**
- **`LearningError`** -- converted flat struct to a proper discriminated union; each variant (`StorageError`, `InsufficientDataError`, etc.) is exported from the package root so callers can narrow exhaustively.
- **`AnomalyDetector.analyze`** -- now returns `AnomalyReport[]` instead of `AnomalyReport | null` so latency and `error_rate` anomalies are both captured for the same pattern; `batchAnalyze` spreads the result array.
- **`AutoLearningInterceptor`** -- added `trackParams` and `trackBody` options: `req.params` / `req.body` are captured into `pattern.metadata`, merged with `customMetadata`.

---

## [2026-05-17] -- Bug fix batch: `http-client`, `result`, `pipeline` → v0.2.0

### Fixed

#### `@backendkit-labs/http-client` v0.2.0

- **`HttpClientModule.forRootAsync`** -- fixed silent "No provider" failure for every `@InjectHttpClient()` call when using the async registration path. `forRootAsync` previously built only a single `HTTP_CLIENT_INSTANCES` array provider and never registered the individual token providers. `HttpClientModuleAsyncOptions` now requires a `clients` field declaring tokens at definition time; `forRootAsync` creates one factory provider per token following the standard NestJS pattern.

#### `@backendkit-labs/result` v0.2.0

- **`any([])`** -- threw `undefined` at runtime when called with an empty array (uninitialized `last!`); now throws a clear error.
- **`parallel()` with `concurrency ≤ 0`** -- caused an infinite loop; now throws a clear error.
- **`withTimeout()`** -- never cleared its internal timer on resolution, leaking the handle; fixed with `try/finally` + `clearTimeout`.
- **`retry()` / `retryWithBackoff()` with `attempts < 1`** -- threw `undefined`; now throw a clear error.

#### `@backendkit-labs/pipeline` v0.2.0

- **Observability hooks** (`onStep`, `onError`, `onStepComplete`, `onComplete`) -- a throwing hook callback could convert a pipeline success into an unhandled rejection or mask the real result. All hooks are now wrapped in `try/catch` so observer errors are swallowed and never corrupt pipeline state.

---

## [2026-05-15] -- `@backendkit-labs/request-scanner` v0.1.5 (rename from http-shield)

### Changed

- **`@backendkit-labs/request-scanner`** -- renamed from `@backendkit-labs/http-shield` (v0.1.4). The name `http-shield` was rejected by the npm registry under its security-term naming policy, same as previous names `waf`, `firewall`, and `request-firewall`.
- **`package.json` description** -- updated to "Pattern-based request scanner" to align with the new package name.
- **Keywords** -- removed `waf` and `firewall`; added `scanner` and `nosql`.
- **Docs** -- renamed docs page from `http-shield.md` to `request-scanner.md`; updated all nav, sidebar, and install references.

### Deprecated

- `@backendkit-labs/http-shield` -- superseded by `@backendkit-labs/request-scanner`. No further versions will be published.

---

## [2026-05-14] -- License change & publish batch

### Changed

- **All packages** -- license changed from MIT to Apache-2.0. New versions published to npm:
  - `@backendkit-labs/result` -> `0.1.3`
  - `@backendkit-labs/bulkhead` -> `0.1.2`
  - `@backendkit-labs/circuit-breaker` -> `0.1.2`
  - `@backendkit-labs/console-animations` -> `0.1.3`
  - `@backendkit-labs/http-client` -> `0.1.1`
  - `@backendkit-labs/observability` -> `0.1.1`
  - `@backendkit-labs/pipeline` -> `0.1.1`
  - `@backendkit-labs/request-scanner` -> `0.1.4` (as `http-shield`)
- **All packages** -- added `LICENSE` file (Apache-2.0 full text) to each package directory so the file is included in the published npm tarball (`"files": ["dist", "README.md", "LICENSE"]`)
- **Root** -- added `NOTICE` file as required by Apache-2.0
- **CI** -- GitHub Actions Node.js version bumped from 20 to 22 in `docs.yml` and `publish.yml`
- **CI** -- test matrix updated from `[18, 20, 22]` to `[20, 22, 24]` in `ci.yml`
- **Docs** -- VitePress footer updated from "MIT License" to "Apache 2.0 License"

---

## [2026-05-14] -- `@backendkit-labs/request-scanner` v0.1.3 (rename from request-firewall)

### Changed

- **`@backendkit-labs/request-scanner`** -- renamed from `@backendkit-labs/request-firewall`. Previous names (`waf`, `firewall`, `request-firewall`) were rejected by the npm registry as forbidden security-related names.

### Deprecated

- `@backendkit-labs/request-firewall` -- superseded by `@backendkit-labs/request-scanner`. No further versions will be published under the old name.
- `@backendkit-labs/firewall` -- superseded by `@backendkit-labs/request-scanner`.
- `@backendkit-labs/waf` -- superseded by `@backendkit-labs/request-scanner`.

---

## [2026-05-14] -- New packages: `pipeline`, `http-client`, `request-scanner`

### Added

#### `@backendkit-labs/pipeline` v0.1.0

Type-safe async Chain of Responsibility pipeline.

- `Pipeline<TCtx, TErr>` -- composes steps that transform a typed context and return `Result<TCtx, PipelineError<TErr>>`
- Two error modes: **stop-on-first** (default) and **collect-all**
- `ConditionalStep` -- runs only when a predicate on the context returns `true`
- Observability hooks: `onStepStart`, `onStepEnd`, `onPipelineEnd`
- NestJS integration: `PipelineModule`, `@InjectPipeline(token)`, `PipelineInterceptor`

#### `@backendkit-labs/http-client` v0.1.0

Production-grade HTTP client built on axios.

- Every request returns `Result<HttpResponse<T>, HttpClientError>` -- no `try/catch` required
- Built-in **circuit breaker** via `@backendkit-labs/circuit-breaker`
- Built-in **retry with exponential backoff + jitter** -- configurable attempts, base delay, and max delay
- **Request cancellation** via `CancelManager` -- tokens registered synchronously before the pre-request pipeline so callers can cancel before the first byte is sent
- **Pre-request pipeline middleware** -- arbitrary `Pipeline` steps run against `HttpCtx` before the axios call
- Normalised `HttpClientError` with typed `type` discriminant: `'network'`, `'timeout'`, `'cancelled'`, `'circuit_open'`, `'client_error'`, `'server_error'`, `'unknown'`
- Per-client **metrics** counter (`total`, `succeeded`, `failed`, `retried`)
- `defineHttpClient(name)` -- creates a typed `HttpClientToken` for NestJS DI
- `HttpClientModule.forRoot(options)` / `HttpClientModule.forRootAsync(options)` -- registers named `HttpClient` instances
- `@InjectHttpClient(token)` -- inject a named client

#### `@backendkit-labs/request-scanner` v0.1.0 (originally published as `@backendkit-labs/waf`)

Pattern-based HTTP request scanner.

- 23 built-in detection rules across 6 attack categories:
  - **SQL Injection** (SQLi)
  - **Cross-Site Scripting** (XSS)
  - **Path Traversal**
  - **Command Injection**
  - **NoSQL Injection**
  - **Server-Side Request Forgery** (SSRF)
- Framework-agnostic core -- works with any Node.js HTTP server
- NestJS integration: `WafModule`, `WafMiddleware`, `SanitizePipe`
- Configurable rule sets, custom rules, and per-route bypass

### Changed

- **Docs site** (`apps/docs/`) -- added full documentation pages for `pipeline`, `http-client`, and `request-scanner`
- **`apps/docs/index.md`** -- added feature cards for Pipeline, HTTP Client, and Request Scanner
- **`apps/docs/guide/getting-started.md`** -- added new packages to the table, installation section, and "Choosing a package" guidance

---

## [2025] -- `@backendkit-labs/result` v0.1.1, `@backendkit-labs/console-animations` v0.1.2

### Fixed

- **`@backendkit-labs/result`** (`0.1.1`) -- bug fixes to resilience primitives (`retry`, `backoff`, `timeout`)
- **`@backendkit-labs/console-animations`** (`0.1.2`) -- rendering fixes for CI environments

---

## [2024] -- Initial releases

### Added

#### `@backendkit-labs/result` v0.1.0

Type-safe Result monad -- zero runtime dependencies.

- `ok<T>(value)` / `fail<E>(error)` -- construct `Result<T, E>` values
- `map`, `flatMap`, `mapError`, `recover` -- composable transformations
- `isOk()`, `isFail()` -- type-narrowing guards
- Resilience primitives: `retry`, `retryWithBackoff`, `withTimeout`, `withJitter`
- `track()` -- wraps a fallible function and records observability metadata
- NestJS integration: `ResultModule`, `@WithMetrics()` decorator, `RichResult` exception filter

#### `@backendkit-labs/circuit-breaker` v0.1.0

Sliding-window circuit breaker.

- Count-based sliding window -- configurable `slidingWindowSize` and `minimumCalls`
- Failure threshold as a percentage (`failureThreshold`)
- **Business vs. infrastructure error classification** -- `isFailure` predicate lets you exclude domain errors (e.g. 404 Not Found) from circuit counts
- States: `CLOSED` -> `OPEN` -> `HALF_OPEN` with configurable `waitDuration`
- `successThreshold` for HALF_OPEN -> CLOSED promotion
- Typed metrics: `state`, `failureRate`, `callCount`, `failureCount`
- NestJS integration: `CircuitBreakerModule`, `@UseCircuitBreaker()` decorator

#### `@backendkit-labs/bulkhead` v0.1.0

Concurrency limiting inspired by Resilience4j.

- `Bulkhead` -- limits the number of concurrent executions and the size of the waiting queue
- `BulkheadRejectedError` on capacity overflow
- Framework-agnostic core with zero runtime dependencies
- NestJS integration: `BulkheadModule`, `BulkheadGuard`, `BulkheadInterceptor`, `BulkheadMiddleware`

#### `@backendkit-labs/observability` v0.1.0

Observability stack for NestJS.

- **Structured logging** via pino -- JSON output with configurable log level
- **Correlation ID propagation** via `AsyncLocalStorage` -- auto-injected into every log line
- **Metrics shipping** -- pluggable metrics interface with a built-in no-op adapter
- **`@WithMetrics()` decorator** -- records operation duration, success, and failure on any method
- **`PerformanceInterceptor`** -- HTTP request/response timing for all NestJS controllers
- **`GlobalExceptionFilter`** -- structured error logging for unhandled exceptions
- Optional **OpenTelemetry** spans -- pass an OTel `Tracer` via `forRoot()` to emit distributed traces
- `ObservabilityModule.forRoot({ serviceName, environment, ... })`

#### `@backendkit-labs/console-animations` v0.1.0

Terminal animations for Node.js CLI tools.

- 17 built-in animation presets: spinners, progress bars, visual effects
- CI-aware -- animations are disabled automatically when `CI=true` or the terminal is not a TTY
- Zero runtime dependencies
- `Animator` class with `start()`, `stop()`, `update()`, `succeed()`, `fail()` lifecycle

---

[Unreleased]: https://github.com/BackendKit-labs/backendkit-monorepo/compare/HEAD...HEAD
