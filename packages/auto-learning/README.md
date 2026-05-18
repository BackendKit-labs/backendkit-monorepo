# @backendkit-labs/auto-learning

[![npm version](https://img.shields.io/npm/v/@backendkit-labs/auto-learning?style=flat-square&color=cb3837)](https://www.npmjs.com/package/@backendkit-labs/auto-learning)
[![CI](https://img.shields.io/github/actions/workflow/status/BackendKit-labs/backendkit-monorepo/ci.yml?style=flat-square&label=CI)](https://github.com/BackendKit-labs/backendkit-monorepo/actions/workflows/ci.yml)
[![License](https://img.shields.io/npm/l/@backendkit-labs/auto-learning?style=flat-square)](LICENSE)
[![Node](https://img.shields.io/node/v/@backendkit-labs/auto-learning?style=flat-square)](package.json)
[![Docs](https://img.shields.io/badge/docs-backendkitlabs.dev-4f7eff?style=flat-square)](https://backendkitlabs.dev/docs/auto-learning/)

> Adaptive resilience configuration for Node.js — automatically tunes circuit breakers, bulkheads, and HTTP clients based on real traffic patterns.

Static resilience configuration is a guess. `@backendkit-labs/auto-learning` observes your actual traffic, detects anomalies, and adjusts thresholds continuously — so your circuit breaker opens at the right rate, your bulkhead concurrency matches real load, and your HTTP timeouts reflect actual p95 latency rather than a number someone typed four years ago.

> **Not machine learning.** This library uses descriptive statistics (averages, percentiles, standard deviation) and deterministic rules with exponential smoothing. There are no models, no training data, and no weights. The name reflects the *behavior* — the system learns what "normal" looks like for your traffic — not the technique.

Optional NestJS integration included — global interceptor that records patterns automatically, and adapters that push config changes directly to `CircuitBreakerRegistry` and `BulkheadRegistry`.

---

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
  - [Pattern Recording](#pattern-recording)
  - [Feedback Loop](#feedback-loop)
  - [Anomaly Detection](#anomaly-detection)
  - [Config Tuning](#config-tuning)
  - [TunableConfig](#tunableconfig)
- [AutoLearningCore API](#autolearningcore-api)
  - [create()](#create)
  - [recordPattern()](#recordpattern)
  - [runOnce()](#runonce)
  - [startFeedbackLoop() / stopFeedbackLoop()](#startfeedbackloop--stopfeedbackloop)
  - [onConfigChange()](#onconfigchange)
  - [onCycle()](#oncycle)
  - [getCurrentConfig()](#getcurrentconfig)
- [Configuration Reference](#configuration-reference)
  - [AnomalyDetectorConfig](#anomalydetectorconfig)
  - [ConfigTunerConfig](#configtunerconfig)
  - [FeedbackLoopConfig](#feedbackloopconfig)
- [Storage Adapters](#storage-adapters)
  - [InMemoryStorage](#inmemorystorage)
  - [FileStorageAdapter](#filestorageadapter)
- [NestJS Integration](#nestjs-integration)
  - [Module Setup](#module-setup)
  - [@AutoLearn — per-route recording](#autolearn--per-route-recording)
  - [Adapters — automatic config propagation](#adapters--automatic-config-propagation)
- [Integration with Circuit Breaker and Bulkhead](#integration-with-circuit-breaker-and-bulkhead)
  - [Automatic (NestJS)](#automatic-nestjs)
  - [Manual (framework-agnostic)](#manual-framework-agnostic)
- [Architecture](#architecture)

---

## Installation

```bash
npm install @backendkit-labs/auto-learning
```

NestJS peer dependencies (only needed for the `/nestjs` subpath):

```bash
npm install @nestjs/common @nestjs/core rxjs
```

To connect to `CircuitBreakerRegistry` or `BulkheadRegistry` via adapters:

```bash
npm install @backendkit-labs/circuit-breaker @backendkit-labs/bulkhead
```

---

## TypeScript Configuration

### Subpath exports (`/nestjs`)

This package uses the `exports` field in `package.json` to expose the `/nestjs` subpath. TypeScript's ability to resolve it depends on the `moduleResolution` setting in your `tsconfig.json`.

**Modern resolution (recommended) — no extra config needed:**

```json
{
  "compilerOptions": {
    "moduleResolution": "bundler"
  }
}
```

`"bundler"`, `"node16"`, and `"nodenext"` all understand the `exports` field natively.

**Legacy resolution (`"node"`) — add a `paths` alias:**

```json
{
  "compilerOptions": {
    "moduleResolution": "node",
    "paths": {
      "@backendkit-labs/auto-learning/nestjs": [
        "./node_modules/@backendkit-labs/auto-learning/dist/nestjs/index"
      ]
    }
  }
}
```

### NestJS decorator support

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

---

## Quick Start

### Framework-agnostic

```typescript
import { AutoLearningCore } from '@backendkit-labs/auto-learning';

const core = AutoLearningCore.create();

// Record a pattern after each request
core.recordPattern({
  method: 'GET',
  path: '/api/orders',
  statusCode: 200,
  durationMs: 142,
  timestamp: new Date(),
});

// React to config changes
core.onConfigChange((config) => {
  console.log('New timeout:', config.httpClient.timeoutMs);
  console.log('New CB threshold:', config.circuitBreaker.failureThreshold);
});

// Start the feedback loop — runs a cycle every 60s by default
core.startFeedbackLoop();
```

### NestJS — zero-config

```typescript
import { AutoLearningModule } from '@backendkit-labs/auto-learning/nestjs';

@Module({
  imports: [
    AutoLearningModule.forRoot({ intervalMs: 60_000 }),
  ],
})
export class AppModule {}
```

Then decorate the routes you want to observe:

```typescript
import { AutoLearn } from '@backendkit-labs/auto-learning/nestjs';

@Controller('orders')
export class OrdersController {
  @Get()
  @AutoLearn()
  findAll() { ... }
}
```

That's it. Every request to `GET /orders` is recorded automatically. The feedback loop runs in the background and adjusts `TunableConfig` as it learns.

---

## Core Concepts

### How it actually works (no ML)

Despite the name, this library does not use machine learning. The techniques are deliberate:

| Technique | Where it's used |
|-----------|----------------|
| Descriptive statistics (avg, p50/p95/p99, error rate) | Aggregating patterns per endpoint |
| Threshold comparison against a rolling baseline | Anomaly detection |
| Exponential smoothing: `current + (target − current) × factor` | Gradual timeout adjustment |
| Deterministic step rules (+1/−1, ±10×n) | Retry and circuit breaker tuning |

**Why not ML?** Statistical rules are transparent, deterministic, and need no training data. You can read the tuning logic, predict its output, and reason about its behavior in production. A neural network that adjusts your circuit breaker threshold is a black box with no explanation for why it opened your circuit at 3 AM.

The trade-off is that the rules are hand-crafted and may not fit every traffic pattern perfectly. The configuration knobs (`smoothingFactor`, `errorRateThreshold`, `latencyStdDevThreshold`) let you adapt the behavior to your system without touching the code.

### Pattern Recording

A **pattern** is a single observation of one HTTP request: method, path, status code, duration, and timestamp. Patterns are the raw data from which everything else is derived.

```typescript
core.recordPattern({
  method: 'POST',
  path: '/api/payments',
  statusCode: 500,
  durationMs: 3200,
  timestamp: new Date(),
  correlationId: 'req-abc123',     // optional — for tracing
  metadata: { region: 'us-east' }, // optional — custom dimensions
});
```

Patterns are stored in a time-windowed buffer (default: last 5 minutes). Older patterns are pruned automatically.

### Feedback Loop

The feedback loop is the heart of the system. On each cycle it:

1. **Collects** all patterns recorded in the current time window
2. **Aggregates** them by `method:path` (avg latency, p50/p95/p99, error rate)
3. **Detects** anomalies against the learned baseline
4. **Tunes** config based on what the aggregates and anomalies reveal
5. **Fires** `onConfigChange` listeners if anything changed
6. **Persists** the new config and a cycle event to storage

The loop requires a minimum number of samples before it tunes (default: 10). Below that threshold, it skips tuning and returns a cycle event with empty `configChanges`.

### Anomaly Detection

The anomaly detector compares the current window against the historical aggregate baseline:

| Metric | Anomaly condition | Severity |
|--------|------------------|----------|
| Latency | actual > baseline × `latencyStdDevThreshold` | `high` / `critical` |
| Error rate | actual > `errorRateThreshold` AND actual > baseline × 2 | `high` |
| Frequency | request count deviates > `frequencyDeviationThreshold` σ | `medium` |
| Unknown endpoint | path not seen before | `low` |

Severity influences how aggressively config is tightened.

### Config Tuning

The tuner adjusts three sections of `TunableConfig` based on what it observes:

**`httpClient.timeoutMs`** — smoothed toward `p95 × 2`, clamped between `minTimeoutMs` and `maxTimeoutMs`:
```
newTimeout = current + (target − current) × smoothingFactor
```
A smoothing factor of 0.3 means changes are gradual — a single spike doesn't immediately inflate the timeout.

**`httpClient.maxRetries`** — increases by 1 when error rate > 10%, decreases by 1 when error rate < 1%. Never drops below 0.

**`circuitBreaker.failureThreshold`** — decreases by `10 × criticalAnomalyCount` when anomalies are detected (min 10), increases by 5 per clean cycle (max 80). A circuit breaker that sees 3 critical anomalies in one cycle will tighten from 50 → 20.

**`bulkhead.maxConcurrentCalls`** — currently preserved at its configured value; future versions will tune it based on concurrency patterns.

### TunableConfig

The config emitted on every change:

```typescript
type TunableConfig = {
  circuitBreaker: {
    failureThreshold: number; // 0–100 (% of calls that must fail to open the circuit)
    openTimeoutMs:    number; // ms to wait in OPEN before probing
  };
  bulkhead: {
    maxConcurrentCalls: number;
  };
  httpClient: {
    timeoutMs:  number;
    maxRetries: number;
  };
};
```

Defaults:

```typescript
{
  circuitBreaker: { failureThreshold: 50, openTimeoutMs: 30_000 },
  bulkhead:       { maxConcurrentCalls: 10 },
  httpClient:     { timeoutMs: 10_000, maxRetries: 3 },
}
```

---

## AutoLearningCore API

### `create()`

Factory method. All internal components are wired automatically.

```typescript
const core = AutoLearningCore.create();

// With options
const core = AutoLearningCore.create({
  storage:      new FileStorageAdapter('./config/auto-learning.json'),
  observability: myLogger,
  anomalyConfig: { errorRateThreshold: 0.1 },
  tunerConfig:   { smoothingFactor: 0.2 },
  loopConfig:    { minSamplesBeforeTuning: 20 },
});
```

### `recordPattern()`

Records a single request observation. Call this after every request you want to track.

```typescript
const result = core.recordPattern({
  method:    'GET',
  path:      '/api/users',
  statusCode: 200,
  durationMs: 85,
  timestamp:  new Date(),
});

if (!result.ok) {
  console.error('Failed to record pattern:', result.error);
}
```

### `runOnce()`

Executes a single feedback cycle immediately — useful for testing or manual triggering.

```typescript
const result = await core.runOnce();

if (result.ok) {
  const { cycleId, patternsProcessed, anomaliesFound, configChanges, durationMs } = result.value;
  console.log(`Cycle ${cycleId}: ${patternsProcessed} patterns, ${anomaliesFound} anomalies`);
  console.log('Config sections changed:', Object.keys(configChanges));
}
```

### `startFeedbackLoop()` / `stopFeedbackLoop()`

Starts or stops the background `setInterval` loop.

```typescript
// Start with default interval (60s)
core.startFeedbackLoop();

// Start with custom interval
core.startFeedbackLoop(30_000); // every 30s

// Stop
core.stopFeedbackLoop();

// Check status
core.isFeedbackLoopRunning(); // boolean
```

### `onConfigChange()`

Registers a callback that fires every time the tuner produces a new config. Multiple listeners are supported.

```typescript
core.onConfigChange((config: TunableConfig) => {
  // Update your HTTP client
  httpClient.setDefaults({ timeout: config.httpClient.timeoutMs });

  // Update circuit breaker manually
  myCircuitBreaker.updateConfig({
    failureThreshold: config.circuitBreaker.failureThreshold,
    openTimeoutMs:    config.circuitBreaker.openTimeoutMs,
  });
});
```

The callback fires only when at least one section of `TunableConfig` actually changed — identical configs are suppressed.

### `onCycle()`

Fires after every completed feedback cycle, regardless of whether config changed.

```typescript
core.onCycle((event) => {
  metrics.record('auto_learning.patterns_processed', event.patternsProcessed);
  metrics.record('auto_learning.anomalies_found', event.anomaliesFound);
  metrics.record('auto_learning.cycle_duration_ms', event.durationMs);
});
```

`LearningCycleEvent` shape:

```typescript
{
  cycleId:           string;           // UUID for this cycle
  timestamp:         Date;
  patternsProcessed: number;           // patterns in the time window
  anomaliesFound:    number;
  configChanges:     Partial<TunableConfig>; // only changed sections
  durationMs:        number;           // total cycle execution time
}
```

### `getCurrentConfig()`

Returns a deep copy of the current `TunableConfig` without triggering a cycle.

```typescript
const config = core.getCurrentConfig();
console.log(config.httpClient.timeoutMs);  // 10000 (default until first cycle)
```

---

## Configuration Reference

### `AnomalyDetectorConfig`

```typescript
const core = AutoLearningCore.create({
  anomalyConfig: {
    // Latency deviation multiplier — actual > baseline × this triggers anomaly
    // Default: 2.5
    latencyStdDevThreshold: 2.5,

    // Error rate above which an anomaly is flagged (0–1)
    // Default: 0.05 (5%)
    errorRateThreshold: 0.05,

    // Frequency deviation in standard deviations before flagging unusual volume
    // Default: 3.0
    frequencyDeviationThreshold: 3.0,

    // Flag endpoints that have never been seen before
    // Default: true
    enableUnknownEndpointDetection: true,
  },
});
```

### `ConfigTunerConfig`

```typescript
const core = AutoLearningCore.create({
  tunerConfig: {
    // Lower bound for httpClient.timeoutMs
    // Default: 1000
    minTimeoutMs: 1000,

    // Upper bound for httpClient.timeoutMs
    // Default: 30000
    maxTimeoutMs: 30_000,

    // Controls how fast timeoutMs moves toward the target (0–1)
    // Lower = smoother but slower. Higher = reactive but noisy.
    // Default: 0.3
    smoothingFactor: 0.3,

    // Step size in ms for timeout adjustments
    // Default: 500
    adjustmentStepMs: 500,
  },
});
```

### `FeedbackLoopConfig`

```typescript
const core = AutoLearningCore.create({
  loopConfig: {
    // Interval between automatic cycles when started with startFeedbackLoop()
    // Default: 60_000 (1 minute)
    defaultIntervalMs: 60_000,

    // How far back patterns are collected for each cycle
    // Default: 5 (minutes)
    windowSizeMinutes: 5,

    // Minimum patterns required in the window before tuning runs
    // Below this count the cycle completes but skips the tuning step
    // Default: 10
    minSamplesBeforeTuning: 10,

    // Minimum time between two consecutive config changes (ms)
    // Prevents thrashing when anomalies appear in consecutive cycles
    // Default: 120_000 (2 minutes)
    cooldownBetweenChangesMs: 120_000,
  },
});
```

---

## Storage Adapters

### `InMemoryStorage`

The default. Patterns, anomalies, and cycle events live in process memory. Config is also in-memory and resets to defaults on restart.

```typescript
import { InMemoryStorage } from '@backendkit-labs/auto-learning';

const core = AutoLearningCore.create({
  storage: new InMemoryStorage(), // this is the default
});
```

Use this in development, tests, or when you don't need config to survive restarts.

### `FileStorageAdapter`

Extends `InMemoryStorage` with config persistence to a JSON file. Patterns, anomalies, and cycle events remain in-memory (re-learned on restart). Only the tuned `TunableConfig` survives across restarts.

```typescript
import { FileStorageAdapter } from '@backendkit-labs/auto-learning';

const core = AutoLearningCore.create({
  storage: new FileStorageAdapter('./config/auto-learning.json'),
});
```

The directory is created automatically if it doesn't exist. The file is written synchronously on every config change to prevent partial writes.

Use this in production when you want to preserve learned thresholds across deploys or restarts without an external database.

### `RedisStorageAdapter`

Extends `InMemoryStorage` with config persistence to Redis. Only the tuned `TunableConfig` is stored in Redis — patterns, anomalies, and cycle events remain in-memory. On startup, `loadConfigAsync()` restores the last saved config from Redis so learned thresholds survive restarts and are shared across multiple instances.

Install from the dedicated subpath (keeps `ioredis` / `redis` out of your main bundle):

```bash
npm install @backendkit-labs/auto-learning
# redis v4 client
npm install redis
# or ioredis
npm install ioredis
```

```typescript
import { RedisStorageAdapter } from '@backendkit-labs/auto-learning/adapters/redis';
import { createClient } from 'redis';

const redisClient = createClient({ url: 'redis://localhost:6379' });
await redisClient.connect();

const storage = new RedisStorageAdapter(redisClient, {
  configKey: 'auto-learning:config',   // Redis key (default: 'auto-learning:config')
  configTtl: 86_400,                    // seconds (default: 86400 — 24 h). omit for no expiry
});

// Restore previously learned config on startup
await storage.loadConfigAsync();

const core = AutoLearningCore.create({ storage });
```

**`RedisClient` interface** — works with `redis` v4, `ioredis`, or any client that satisfies:

```typescript
interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
  setEx?(key: string, seconds: number, value: string): Promise<unknown>; // redis v4
}
```

> `setEx` is used when present (redis v4). If absent (ioredis), `set()` is used without TTL.

**NestJS usage** — pass the adapter via `coreOptions`:

```typescript
AutoLearningModule.forRoot({
  coreOptions: {
    storage: new RedisStorageAdapter(redisClient, { configKey: 'my-service:al-config' }),
  },
})
```

Use this in production with multiple replicas — all instances share the same learned `TunableConfig` and converge on the same thresholds.

**Custom `StorageAdapter`:** implement the `StorageAdapter` interface to plug in PostgreSQL, DynamoDB, or any other backend.

---

## NestJS Integration

Import from the `/nestjs` subpath — framework code is tree-shaken from the core bundle.

### Module Setup

```typescript
import { AutoLearningModule } from '@backendkit-labs/auto-learning/nestjs';

@Module({
  imports: [
    AutoLearningModule.forRoot({
      // Feedback loop interval
      // Default: 60_000
      intervalMs: 60_000,

      // Observability — pass NestJS Logger or any LoggerService
      observability: {
        logger: new Logger('AutoLearning'),
        metrics: {
          increment: (name, val, tags) => statsd.increment(name, val, tags),
          gauge:     (name, val, tags) => statsd.gauge(name, val, tags),
          histogram: (name, val, tags) => statsd.histogram(name, val, tags),
        },
      },

      // Fine-tune the core components
      coreOptions: {
        storage:      new FileStorageAdapter('./config/auto-learning.json'),
        anomalyConfig: { errorRateThreshold: 0.1 },
        tunerConfig:   { smoothingFactor: 0.2 },
        loopConfig:    { minSamplesBeforeTuning: 20 },
      },
    }),
  ],
})
export class AppModule {}
```

`AutoLearningModule.forRoot()` is **global** — no need to re-import it in feature modules.

It registers:
- `AUTO_LEARNING_INSTANCE` — the `AutoLearningCore` instance (injectable by token)
- `AutoLearningInterceptor` — global APP_INTERCEPTOR that records patterns automatically
- `AutoLearningAdaptersService` — wires CB/BH registries when `adapters` is configured

### `@AutoLearn` — per-route recording

Add `@AutoLearn()` to any controller method to start recording its traffic. The global interceptor handles the rest — no manual `recordPattern()` calls needed.

```typescript
import { AutoLearn } from '@backendkit-labs/auto-learning/nestjs';

@Controller('payments')
export class PaymentsController {
  // Basic — records method, path, status code, and duration
  @Post()
  @AutoLearn()
  charge(@Body() dto: ChargeDto) { ... }

  // With custom metadata attached to each pattern
  @Get(':id')
  @AutoLearn({
    customMetadata: (req) => ({
      region:   req.headers['x-region'],
      clientId: req.headers['x-client-id'],
    }),
  })
  getCharge(@Param('id') id: string) { ... }
}
```

`@AutoLearn` options:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `customMetadata` | `(req) => Record<string, unknown>` | `undefined` | Attach arbitrary data to each recorded pattern |

Routes without `@AutoLearn()` are silently ignored — the interceptor is a no-op for undecorated handlers.

### Inject `AutoLearningCore` directly

```typescript
import { Inject } from '@nestjs/common';
import { AUTO_LEARNING_INSTANCE } from '@backendkit-labs/auto-learning/nestjs';
import type { AutoLearningCore } from '@backendkit-labs/auto-learning';

@Injectable()
export class StatsService {
  constructor(
    @Inject(AUTO_LEARNING_INSTANCE)
    private readonly learning: AutoLearningCore,
  ) {}

  getConfig() {
    return this.learning.getCurrentConfig();
  }

  async triggerCycle() {
    return this.learning.runOnce();
  }
}
```

### Adapters — automatic config propagation

The `adapters` option connects auto-learning directly to `CircuitBreakerRegistry` and `BulkheadRegistry`. When the tuner produces a new config, every registered instance is updated automatically — no `onConfigChange` wiring needed.

```typescript
import { AutoLearningModule } from '@backendkit-labs/auto-learning/nestjs';
import { CircuitBreakerModule } from '@backendkit-labs/circuit-breaker/nestjs';
import { BulkheadModule } from '@backendkit-labs/bulkhead/nestjs';

@Module({
  imports: [
    CircuitBreakerModule,
    BulkheadModule,
    AutoLearningModule.forRoot({
      adapters: {
        circuitBreaker: true, // auto-updates all CircuitBreaker instances
        bulkhead: true,       // auto-updates all Bulkhead instances
      },
    }),
  ],
})
export class AppModule {}
```

**How it works:** on module init, `AutoLearningAdaptersService` resolves `CircuitBreakerRegistry` and `BulkheadRegistry` from the NestJS DI container. On every `onConfigChange` event, it calls `updateConfig()` on all registered instances.

If `CircuitBreakerModule` or `BulkheadModule` is not imported, the adapter logs a warning and skips gracefully — it does not throw.

---

## Integration with Circuit Breaker and Bulkhead

### Automatic (NestJS)

See [Adapters](#adapters--automatic-config-propagation) above — one flag, no wiring.

### Manual (framework-agnostic)

Wire `onConfigChange` to call `updateConfig()` on your instances directly:

```typescript
import { AutoLearningCore } from '@backendkit-labs/auto-learning';
import { CircuitBreakerRegistry } from '@backendkit-labs/circuit-breaker';
import { BulkheadRegistry } from '@backendkit-labs/bulkhead';

const core = AutoLearningCore.create();
const cbRegistry = new CircuitBreakerRegistry();
const bhRegistry = new BulkheadRegistry();

// Create your instances
const paymentsCB = cbRegistry.getOrCreate({ name: 'payments' });
const paymentsBH = bhRegistry.getOrCreate({ name: 'payments' });

// Wire config propagation
core.onConfigChange((config) => {
  // Update every registered circuit breaker
  for (const name of Object.keys(cbRegistry.getAllMetrics())) {
    cbRegistry.getOrCreate({ name }).updateConfig({
      failureThreshold: config.circuitBreaker.failureThreshold,
      openTimeoutMs:    config.circuitBreaker.openTimeoutMs,
    });
  }

  // Update every registered bulkhead
  for (const name of Object.keys(bhRegistry.getAllMetrics())) {
    bhRegistry.getOrCreate({ name }).updateConfig({
      maxConcurrentCalls: config.bulkhead.maxConcurrentCalls,
    });
  }
});

// Start learning
core.startFeedbackLoop();

// Record traffic
core.recordPattern({
  method: 'POST', path: '/payments', statusCode: 200, durationMs: 120, timestamp: new Date(),
});
```

**What happens when an anomaly is detected:**

```
12 ok + 3 errors (20% error rate) in one window
  → AnomalyDetector: 3 HIGH anomalies
  → ConfigTuner: failureThreshold = max(50 − 10×3, 10) = 20
  → onConfigChange fires
  → CircuitBreaker.updateConfig({ failureThreshold: 20 })   ← tighter, reacts sooner
  → 2 clean cycles later: failureThreshold recovers toward 30, 35, ...
```

---

## Architecture

```
@backendkit-labs/auto-learning                (core — zero framework dependencies)
  AutoLearningCore                            facade — wires all components together
  PatternRegistry                             time-windowed pattern buffer + aggregation
  AnomalyDetector                             statistical analysis against baselines
  ConfigTuner                                 smoothed config adjustment + persistence
  FeedbackLoop                                setInterval orchestrator
  InMemoryStorage                             default in-process storage
  FileStorageAdapter                          config persistence across restarts

@backendkit-labs/auto-learning/nestjs        (optional NestJS layer)
  AutoLearningModule                          DynamicModule — registers all providers
  AutoLearningInterceptor                     global APP_INTERCEPTOR — auto-records @AutoLearn routes
  AutoLearningAdaptersService                 wires CB/BH registries on config change
  @AutoLearn                                  route decorator — opts a handler into recording
```

**Dependency direction:**

```
auto-learning ──→ circuit-breaker   (optional peer — adapters only)
auto-learning ──→ bulkhead          (optional peer — adapters only)
auto-learning ──→ observability     (optional peer — NestJS adapter)
auto-learning ──→ result            (core utility)
```

`circuit-breaker` and `bulkhead` do **not** depend on `auto-learning` — the integration is one-directional. This avoids circular dependencies and keeps resilience primitives standalone.

---

## License

Apache-2.0 — [BackendKit Labs](https://github.com/BackendKit-labs)
