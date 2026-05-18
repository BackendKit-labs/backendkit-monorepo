/**
 * OTel SDK bootstrap — must be loaded BEFORE any app modules.
 * Loaded via: node --require ./dist/instrumentation.js dist/main.js
 */
import { NodeSDK }                           from '@opentelemetry/sdk-node';
import { OTLPTraceExporter }                 from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPMetricExporter }                from '@opentelemetry/exporter-metrics-otlp-grpc';
import { PeriodicExportingMetricReader }     from '@opentelemetry/sdk-metrics';
import { Resource }                          from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME }                 from '@opentelemetry/semantic-conventions';
import { getNodeAutoInstrumentations }       from '@opentelemetry/auto-instrumentations-node';

const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4317';

const sdk = new NodeSDK({
  resource: new Resource({
    [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? 'otel-demo',
  }),

  traceExporter: new OTLPTraceExporter({ url: endpoint }),

  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({ url: endpoint }),
    exportIntervalMillis: 10_000,
  }),

  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
      '@opentelemetry/instrumentation-dns': { enabled: false },
    }),
  ],
});

sdk.start();

process.on('SIGTERM', () => { sdk.shutdown().finally(() => process.exit(0)); });
process.on('SIGINT',  () => { sdk.shutdown().finally(() => process.exit(0)); });
