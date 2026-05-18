# BackendKit Labs — OTel Integration Example

Self-contained Docker Compose stack showing BackendKit running with full OpenTelemetry observability:
**traces → Jaeger**, **metrics → Prometheus → Grafana**.

## Stack

| Service | Port | Purpose |
|---------|------|---------|
| `app` | 3000 | NestJS demo (BackendKit) |
| `otel-collector` | 4317 / 4318 | Receives OTLP from app, fans out to Jaeger + Prometheus |
| `jaeger` | 16686 | Trace UI |
| `prometheus` | 9090 | Metrics store (remote-write receiver) |
| `grafana` | 3001 | Dashboard UI (anonymous admin, no login) |

## Quick start

```bash
# From this directory
docker compose up --build

# Trigger some traces
curl http://localhost:3000/demo/call     # wraps a CB + bulkhead call
curl http://localhost:3000/demo/status   # shows CB state + auto-learning config
```

Then open:
- **Traces**: http://localhost:16686 — search for service `otel-demo`
- **Grafana**: http://localhost:3001 — dashboard *BackendKit — OTel Demo*

## How it works

```
NestJS app
  ├── src/instrumentation.ts   ← OTel SDK (loaded via --require BEFORE NestJS)
  ├── src/main.ts              ← NestJS bootstrap
  ├── src/app.module.ts        ← ObservabilityModule + CircuitBreakerModule + AutoLearningModule
  └── src/demo/
      ├── demo.controller.ts   ← GET /demo/call  (decorated with @AutoLearn)
      └── demo.service.ts      ← fetch wrapped in CB + bulkhead, manual span added
```

### OTel SDK bootstrap

`instrumentation.ts` starts the SDK before NestJS imports any module:

```ts
node --require ./dist/instrumentation.js dist/main
```

It configures:
- **OTLP gRPC trace exporter** → OTel Collector → Jaeger
- **OTLP gRPC metrics exporter** with 10 s interval → OTel Collector → Prometheus
- **Auto-instrumentations** for HTTP, Express, NestJS (fs/dns disabled)

### BackendKit modules in use

| Module | What it adds |
|--------|-------------|
| `ObservabilityModule` | Structured logger, `CorrelationInterceptor`, `PerformanceInterceptor` |
| `CircuitBreakerModule` | `CircuitBreakerService` (AsyncMutex-safe state machine) |
| `BulkheadModule` | `BulkheadService` (concurrent-call cap) |
| `AutoLearningModule` | Self-tuning config via feedback loop |

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OTEL_SERVICE_NAME` | `otel-demo` | Service name in traces/metrics |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4317` | OTel Collector gRPC address |
| `EXTERNAL_API_URL` | `https://httpbin.org/delay/1` | URL the demo calls through the circuit breaker |

## Local dev (without Docker)

```bash
# Start infrastructure only
docker compose up otel-collector jaeger prometheus grafana

# Run the app locally
npm install
npm run build
npm start
```
