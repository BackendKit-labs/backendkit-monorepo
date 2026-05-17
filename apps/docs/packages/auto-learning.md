---
title: Auto-Learning
description: Adaptive resilience for Node.js — monitors real traffic patterns and automatically tunes circuit breaker thresholds, bulkhead concurrency, and HTTP client timeouts.
---

# @backendkit-labs/auto-learning

[![npm](https://img.shields.io/npm/v/@backendkit-labs/auto-learning?style=flat-square&color=cb3837)](https://www.npmjs.com/package/@backendkit-labs/auto-learning)
[![License](https://img.shields.io/npm/l/@backendkit-labs/auto-learning?style=flat-square)](https://github.com/BackendKit-labs/backendkit-monorepo/blob/master/LICENSE)
[![Node](https://img.shields.io/node/v/@backendkit-labs/auto-learning?style=flat-square)](https://nodejs.org)

> Adaptive resilience for Node.js — automatically tunes your circuit breaker, bulkhead, and HTTP client configuration based on real traffic patterns. No ML models, no cloud services, no manual threshold guessing.

Manual threshold tuning is guesswork. A `failureThreshold` that works under 50 RPS silently misclassifies failures at 500 RPS. `auto-learning` closes the feedback loop: it observes every request, detects anomalies statistically, and adjusts your configuration automatically.

## Installation

```bash
npm install @backendkit-labs/auto-learning
```

NestJS peer dependencies (only for the `/nestjs` subpath):

```bash
npm install @nestjs/common @nestjs/core rxjs
```

## Quick Start

```typescript
import { AutoLearningCore } from '@backendkit-labs/auto-learning';

// Create with defaults — in-memory storage, noop observability
const core = AutoLearningCore.create();

// Record a request pattern
core.recordPattern({
  method:     'GET',
  path:       '/users/:id',
  statusCode: 200,
  durationMs: 142,
  timestamp:  new Date(),
});

// Start the feedback loop — runs every 60s by default
core.startFeedbackLoop();

// React to config changes
core.onConfigChange((config) => {
  circuitBreaker.updateConfig({ failureThreshold: config.circuitBreaker.failureThreshold });
  console.log('New timeout:', config.httpClient.timeoutMs);
});

// Inspect the current tuned config
console.log(core.getCurrentConfig());
// {
//   circuitBreaker: { failureThreshold: 50, openTimeoutMs: 30000 },
//   bulkhead:       { maxConcurrentCalls: 10 },
//   httpClient:     { timeoutMs: 5000, maxRetries: 3 },
// }
```

## How It Works

The feedback loop runs three steps on a configurable interval (default: 60 seconds):

```
┌─────────────────────────────────────────────────────┐
│                  Feedback Loop                       │
│                                                      │
│  record()  →  aggregate  →  detect  →  tune  →  ↺   │
│                                                      │
│  EndpointPattern   AggregatePattern   TunableConfig  │
└─────────────────────────────────────────────────────┘
```

1. **Record** — each request is stored as an `EndpointPattern` (method, path, status, duration, timestamp)
2. **Aggregate** — patterns are grouped by endpoint and summarized: p50, p95, p99 latency, error rate, call frequency
3. **Detect** — z-score analysis and error rate thresholds flag latency spikes, error surges, and unknown endpoints
4. **Tune** — configuration is adjusted based on aggregates and anomalies, with smoothing and cooldown to avoid oscillation

### Detection Algorithms

| Anomaly type | Algorithm | Default threshold |
|---|---|---|
| **Latency spike** | `\|durationMs − avgDurationMs\| / stdDev` | 2.5 standard deviations |
| **Error surge** | 5xx status on normally-healthy endpoints | 5% error rate baseline |
| **Unknown endpoint** | New `method + path` not seen in baseline | Always reported (once per cycle) |

Standard deviation is approximated as `(p95Ms − p50Ms) / 2` — no historical distribution required.

Anomaly severity: `low` → `medium` → `high` → `critical` (at 3× / 4× / 5× deviation).

### Tuning Algorithms

| Config key | Trigger | Algorithm |
|---|---|---|
| `httpClient.timeoutMs` | Always | `clamp(max(p95Ms) × 2, min, max)` with 0.3 smoothing factor |
| `httpClient.maxRetries` | Error rate | +1 if errorRate > 10%, −1 if errorRate < 1% |
| `circuitBreaker.failureThreshold` | Anomaly severity | −10 per high/critical anomaly (min 10), +5 when stable (max 80) |
| `bulkhead.maxConcurrentCalls` | Managed externally | Exposed via `TunableConfig`, apply manually |

A 60-second cooldown prevents thrashing — config only changes when the delta exceeds `adjustmentStepMs` (default 500ms).

## Core API

### `AutoLearningCore.create(options?)`

```typescript
import { AutoLearningCore, FileStorageAdapter } from '@backendkit-labs/auto-learning';

const core = AutoLearningCore.create({
  storage: new FileStorageAdapter('./data/auto-learning-config.json'),

  anomalyConfig: {
    latencyStdDevThreshold:         2.5,   // z-score threshold for latency anomalies
    errorRateThreshold:             0.05,  // baseline error rate considered healthy
    frequencyDeviationThreshold:    3.0,   // z-score for call frequency anomalies
    enableUnknownEndpointDetection: true,
  },

  tunerConfig: {
    minTimeoutMs:      1_000,
    maxTimeoutMs:     30_000,
    smoothingFactor:    0.3,  // how aggressively to move toward target (0–1)
    adjustmentStepMs:   500,  // minimum change before applying
    cooldownMs:      60_000,  // minimum ms between config applications
  },

  loopConfig: {
    defaultIntervalMs:       60_000, // how often the loop runs
    windowSizeMinutes:           5,  // lookback window for aggregation
    minSamplesBeforeTuning:     10,  // skip tuning if fewer patterns in window
    pruneTtlHours:              24,  // how long to retain patterns
  },
});
```

### `recordPattern(pattern)`

```typescript
core.recordPattern({
  method:        'POST',
  path:          '/payments',
  statusCode:    201,
  durationMs:    380,
  timestamp:     new Date(),
  correlationId: req.headers['x-correlation-id'], // optional
  metadata:      { region: 'us-east-1' },         // optional
});
```

### `startFeedbackLoop(intervalMs?)` / `stopFeedbackLoop()`

```typescript
core.startFeedbackLoop(30_000); // run every 30s instead of default 60s
core.isFeedbackLoopRunning();   // boolean

// Run one cycle manually (useful for testing)
const result = await core.runOnce();
if (result.ok) {
  console.log(`Processed ${result.value.patternsProcessed} patterns`);
  console.log(`Found ${result.value.anomaliesFound} anomalies`);
}

core.stopFeedbackLoop();
```

### `onConfigChange(callback)` / `onCycle(callback)`

```typescript
// Called when tuning produces a new config — unsubscribe function returned
const unsub = core.onConfigChange((config: TunableConfig) => {
  myCircuitBreaker.updateConfig({
    failureThreshold: config.circuitBreaker.failureThreshold,
  });
  myHttpClient.setTimeout(config.httpClient.timeoutMs);
});

// Called after every learning cycle
core.onCycle((event: LearningCycleEvent) => {
  logger.info('Auto-learning cycle completed', {
    cycleId:           event.cycleId,
    patternsProcessed: event.patternsProcessed,
    anomaliesFound:    event.anomaliesFound,
    durationMs:        event.durationMs,
    configChanges:     event.configChanges,
  });
});

unsub(); // unsubscribe when done
```

### `getCurrentConfig()`

```typescript
const config: TunableConfig = core.getCurrentConfig();
// {
//   circuitBreaker: { failureThreshold: 45, openTimeoutMs: 30000 },
//   bulkhead:       { maxConcurrentCalls: 10 },
//   httpClient:     { timeoutMs: 7600, maxRetries: 3 },
// }
```

## Types Reference

### `EndpointPattern`

The raw observation recorded per request:

```typescript
type EndpointPattern = {
  method:        string;       // 'GET', 'POST', etc.
  path:          string;       // '/users/:id' — use route template, not actual URL
  statusCode:    number;
  durationMs:    number;
  timestamp:     Date;
  correlationId?: string;
  metadata?:     Record<string, unknown>;
};
```

::: tip Use route templates, not actual URLs
Record `/users/:id`, not `/users/123`. The pattern registry keys by `method + path` — recording raw URLs will produce thousands of unique keys and break aggregation.
:::

### `TunableConfig`

The config that the tuner produces and exposes for you to apply:

```typescript
type TunableConfig = {
  circuitBreaker: {
    failureThreshold: number; // 10–80
    openTimeoutMs:    number;
  };
  bulkhead: {
    maxConcurrentCalls: number;
  };
  httpClient: {
    timeoutMs:  number; // 1000–30000
    maxRetries: number;
  };
};
```

### `AnomalyReport`

```typescript
type AnomalyReport = {
  id:            string;
  endpoint:      string;           // 'GET /users/:id'
  severity:      'low' | 'medium' | 'high' | 'critical';
  metric:        'latency' | 'error_rate' | 'frequency' | 'unknown_endpoint';
  expectedValue: number;
  actualValue:   number;
  deviation:     number;           // standard deviations from baseline
  detectedAt:    Date;
};
```

### `LearningCycleEvent`

```typescript
type LearningCycleEvent = {
  cycleId:           string;
  timestamp:         Date;
  patternsProcessed: number;
  anomaliesFound:    number;
  configChanges:     Partial<TunableConfig>; // only changed sections
  durationMs:        number;
};
```

## Storage Adapters

### `InMemoryStorage` (default)

Ephemeral — all data is lost on process restart. Good for development and testing.

```typescript
import { InMemoryStorage } from '@backendkit-labs/auto-learning';

const storage = new InMemoryStorage({
  maxPatterns:  10_000, // FIFO — oldest dropped when exceeded
  maxAnomalies:  1_000,
  maxCycles:     1_000,
});
```

### `FileStorageAdapter`

Persists `TunableConfig` to a JSON file so learned thresholds survive restarts. Patterns and anomalies remain in-memory (they are re-learned from live traffic).

```typescript
import { FileStorageAdapter } from '@backendkit-labs/auto-learning';

const storage = new FileStorageAdapter('./data/auto-learning-config.json');
// File is created automatically if it doesn't exist.
// Directory is created recursively if needed.
```

### Custom `StorageAdapter`

Implement the interface to persist to Redis, a database, or any external store:

```typescript
import type { StorageAdapter } from '@backendkit-labs/auto-learning';

class RedisStorageAdapter implements StorageAdapter {
  async savePattern(pattern) { ... }
  async getPatterns(windowStart, windowEnd) { ... }
  async getAggregates(windowMinutes, windowEnd?) { ... }
  async saveAnomaly(report) { ... }
  async getRecentAnomalies(limit) { ... }
  async saveConfig(config) { ... }
  async loadConfig() { ... }
  async saveCycleEvent(event) { ... }
  async getLastCycleTime() { ... }
  async prune(before) { ... }
}
```

All methods return `Result<T, LearningError>` — use `ok()` and `fail()` from `@backendkit-labs/result`.

## Observability Adapter

Wire auto-learning into your existing logger and metrics backend:

```typescript
import type { ObservabilityAdapter } from '@backendkit-labs/auto-learning';

class MyObservabilityAdapter implements ObservabilityAdapter {
  info(msg, meta?)  { logger.info(`[AutoLearn] ${msg}`, meta); }
  warn(msg, meta?)  { logger.warn(`[AutoLearn] ${msg}`, meta); }
  error(msg, meta?) { logger.error(`[AutoLearn] ${msg}`, meta); }
  debug(msg, meta?) { logger.debug(`[AutoLearn] ${msg}`, meta); }

  incrementMetric(name, value = 1, tags?) { metrics.increment(`auto_learning.${name}`, value, tags); }
  gaugeMetric(name, value, tags?)         { metrics.gauge(`auto_learning.${name}`, value, tags); }
  histogramMetric(name, value, tags?)     { metrics.histogram(`auto_learning.${name}`, value, tags); }
}

const core = AutoLearningCore.create({ observability: new MyObservabilityAdapter() });
```

**Metrics emitted:**

| Metric | Type | Description |
|---|---|---|
| `patterns.recorded` | counter | Per endpoint (tags: `method`, `path`) |
| `patterns.duration_ms` | histogram | Per endpoint |
| `anomalies.detected` | counter | Per cycle |
| `cycle.duration_ms` | histogram | Feedback loop cycle duration |
| `cycle.patterns_count` | gauge | Patterns processed per cycle |
| `config.changes` | counter | When tuning produces new config |

## NestJS Integration

```typescript
import { AutoLearningModule } from '@backendkit-labs/auto-learning/nestjs';
import { FileStorageAdapter } from '@backendkit-labs/auto-learning';

@Module({
  imports: [
    AutoLearningModule.forRoot({
      intervalMs: 30_000, // run every 30s
      autoStart:  true,   // start loop on bootstrap (default: true)

      // Wire into your logger and metrics
      observability: {
        logger: new Logger('AutoLearn'),
        metrics: {
          increment: (name, value, tags) => prometheus.counter(name).inc(value),
          histogram: (name, value, tags) => prometheus.histogram(name).observe(value),
        },
      },

      // Automatically apply tuned config to circuit breakers and bulkheads
      adapters: {
        circuitBreaker: true, // requires CircuitBreakerModule to be imported
        bulkhead:       true, // requires BulkheadModule to be imported
      },
    }),
  ],
})
export class AppModule {}
```

### `@AutoLearn()` decorator

Marks a controller method for automatic pattern recording via `AutoLearningInterceptor`:

```typescript
import { AutoLearn, AutoLearningInterceptor } from '@backendkit-labs/auto-learning/nestjs';

// Register globally
app.useGlobalInterceptors(app.get(AutoLearningInterceptor));

// Opt-in per route
@Controller('users')
export class UsersController {
  @Get(':id')
  @AutoLearn()
  findOne(@Param('id') id: string) { ... }

  @Post()
  @AutoLearn({ trackBody: false }) // don't include body metadata
  create(@Body() dto: CreateUserDto) { ... }
}
```

The interceptor records method, path (from `req.route.path`), status code, and duration for every decorated route. Errors are captured with status extracted from `error.getStatus()` or defaulting to 500.

### Injecting the core

```typescript
import { Inject } from '@nestjs/common';
import { AUTO_LEARNING_INSTANCE } from '@backendkit-labs/auto-learning/nestjs';
import type { AutoLearningCore } from '@backendkit-labs/auto-learning';

@Injectable()
export class ResilienceService {
  constructor(
    @Inject(AUTO_LEARNING_INSTANCE) private readonly learning: AutoLearningCore,
  ) {}

  getConfig() {
    return this.learning.getCurrentConfig();
  }

  async runDiagnostic() {
    return this.learning.runOnce();
  }
}
```

## Architecture

```
@backendkit-labs/auto-learning          (core — zero framework dependencies)
  AutoLearningCore                      factory + facade over the four subsystems
  PatternRegistry                       records and aggregates EndpointPattern
  AnomalyDetector                       z-score latency + error rate detection
  ConfigTuner                           smoothed threshold adjustment with cooldown
  FeedbackLoop                          orchestrates the cycle on a setInterval

  StorageAdapter (interface)
    InMemoryStorage                     default — ephemeral, FIFO circular buffers
    FileStorageAdapter                  persists TunableConfig to JSON file

  ObservabilityAdapter (interface)
    NoopObservabilityAdapter            default — silent

@backendkit-labs/auto-learning/nestjs  (optional NestJS layer)
  AutoLearningModule                    DynamicModule — forRoot()
  AutoLearningInterceptor               records patterns from decorated routes
  @AutoLearn()                          opt-in per-route decorator
  AutoLearningAdaptersService           wires TunableConfig into CB + Bulkhead registries
  BackendKitObservabilityAdapter        bridges to NestJS Logger + custom metrics
```
