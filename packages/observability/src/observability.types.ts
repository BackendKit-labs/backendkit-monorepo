import { CircuitBreakerConfig }        from '@backendkit-labs/circuit-breaker';
import { WinstonHttpTransportOptions } from './logger/winston-http.transport.js';

export interface ObservabilityOptions {
  /** Identifies this service in every log entry and metric. */
  serviceName: string;

  /** E.g. "production", "staging". Defaults to "production". */
  environment?: string;

  /** Minimum log level (winston levels). Defaults to "info". */
  logLevel?: 'error' | 'warn' | 'info' | 'http' | 'verbose' | 'debug' | 'silly';

  /**
   * When present, logs are also shipped to a remote HTTP endpoint.
   * Omit to keep logs local-only.
   */
  http?: Omit<WinstonHttpTransportOptions, 'format'>;

  /**
   * When present, metrics are pushed to a remote HTTP endpoint.
   * Omit to disable metric shipping.
   */
  metrics?: MetricsOptions;
}

export interface MetricsOptions {
  /** Full URL of the metrics-ingest endpoint. */
  url: string;

  /** Bearer token sent in `Authorization` header. */
  authToken?: string;

  /** Additional static headers merged into every request. */
  headers?: Record<string, string>;

  /** Flush interval in ms (default 10 000). */
  flushIntervalMs?: number;

  /** Maximum events held in the in-memory buffer (default 5000). */
  maxBufferSize?: number;

  /** Request timeout in ms (default 5000). */
  timeoutMs?: number;

  /**
   * Override any circuit breaker config fields.
   * `name` and `isFailure` are set internally and cannot be overridden.
   *
   * Transport defaults: failureThreshold 60%, slidingWindowSize 5,
   * minimumCalls 3, openTimeoutMs 30 000, halfOpenMaxCalls 1.
   */
  circuitBreaker?: Partial<Omit<CircuitBreakerConfig, 'name' | 'isFailure'>>;
}

export interface MetricEvent {
  name:        string;
  value:       number;
  unit?:       string;
  tags?:       Record<string, string>;
  timestamp:   string;
  serviceName: string;
  environment: string;
  correlationId?: string;
}
