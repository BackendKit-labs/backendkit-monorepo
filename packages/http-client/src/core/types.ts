import type { PipelineStep } from '@backendkit-labs/pipeline';
import type { CircuitBreakerOptions, CircuitBreakerState, CircuitBreakerMetrics } from '@backendkit-labs/circuit-breaker';

export type { CircuitBreakerState, CircuitBreakerMetrics };

export type HttpErrorType = 'http' | 'network' | 'cancelled' | 'circuit-open' | 'timeout';

export interface HttpClientError {
  type:     HttpErrorType;
  message:  string;
  status?:  number;
  data?:    unknown;
  cause?:   unknown;
}

export interface HttpResponse<T = unknown> {
  data:    T;
  status:  number;
  headers: Record<string, string>;
}

/** Mutable context passed through the pre-request pipeline steps. */
export interface HttpCtx {
  url:           string;
  method:        string;
  data?:         unknown;
  headers:       Record<string, string>;
  params?:       Record<string, unknown>;
  timeout?:      number;
  cancelKey?:    string;
  correlationId?: string;
}

export interface RequestConfig {
  headers?:       Record<string, string>;
  params?:        Record<string, unknown>;
  timeout?:       number;
  /** Key used to identify and cancel this request programmatically. */
  cancelKey?:     string;
  correlationId?: string;
}

export interface RetryConfig {
  /** Number of retry attempts after the first failure. */
  attempts:    number;
  delayMs?:    number;
  maxDelayMs?: number;
  jitter?:     boolean;
  /** Return false to stop retrying on a specific error. */
  shouldRetry?: (error: HttpClientError, attempt: number) => boolean;
}

export interface HttpClientConfig {
  baseURL?:       string;
  timeout?:       number;
  headers?:       Record<string, string>;
  circuitBreaker?: CircuitBreakerOptions;
  retry?:         RetryConfig;
  /** Pre-request pipeline steps. Receive and transform the HttpCtx before the call is made. */
  steps?:         PipelineStep<HttpCtx, HttpClientError>[];
}

export interface HttpMetrics {
  requests:    number;
  success:     number;
  failed:      number;
  cancelled:   number;
  circuitOpen: number;
  retried:     number;
}

/** Typed injection token for named HTTP clients. */
export class HttpClientToken {
  readonly description: string;
  readonly symbol:      symbol;

  declare readonly _phantom: never;

  constructor(name: string) {
    this.description = `HttpClient(${name})`;
    this.symbol      = Symbol(`HttpClient(${name})`);
  }
}

export function defineHttpClient(name: string): HttpClientToken {
  return new HttpClientToken(name);
}
