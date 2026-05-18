import axios from 'axios';
import type { AxiosInstance, CancelToken } from 'axios';
import { ok, fail } from '@backendkit-labs/result';
import type { Result } from '@backendkit-labs/result';
import { CircuitBreaker, CircuitBreakerOpenError, DEFAULT_CIRCUIT_BREAKER_CONFIG, isHttpServerError } from '@backendkit-labs/circuit-breaker';
import type { CircuitBreakerConfig } from '@backendkit-labs/circuit-breaker';
import { Pipeline } from '@backendkit-labs/pipeline';
import { CancelManager } from './cancel-manager.js';
import type {
  HttpClientConfig,
  HttpClientError,
  HttpCtx,
  HttpMetrics,
  HttpResponse,
  RequestConfig,
  RetryConfig,
} from './types.js';

const DEFAULT_RETRY: Required<RetryConfig> = {
  attempts:    0,
  delayMs:     100,
  maxDelayMs:  5_000,
  jitter:      true,
  shouldRetry: (e) =>
    e.type === 'network' || e.type === 'timeout' || (e.type === 'http' && (e.status ?? 0) >= 500),
};

export class HttpClient {
  private readonly axiosInstance: AxiosInstance;
  private readonly cb:            CircuitBreaker | undefined;
  private readonly pipeline:      Pipeline<HttpCtx, HttpClientError>;
  private readonly retry:         Required<RetryConfig>;
  private readonly cancelMgr      = new CancelManager();
  private readonly _metrics: HttpMetrics = {
    requests: 0, success: 0, failed: 0, cancelled: 0, circuitOpen: 0, retried: 0,
  };

  constructor(config: HttpClientConfig = {}) {
    this.axiosInstance = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout ?? 10_000,
      headers: config.headers,
    });

    if (config.circuitBreaker) {
      const { name: cbName, ...cbRest } = config.circuitBreaker;
      this.cb = new CircuitBreaker({
        name:      cbName ?? 'http-client',
        ...DEFAULT_CIRCUIT_BREAKER_CONFIG,
        isFailure: isHttpServerError,
        ...cbRest,
      } as CircuitBreakerConfig);
    }

    const p = new Pipeline<HttpCtx, HttpClientError>();
    for (const step of config.steps ?? []) p.pipe(step);
    this.pipeline = p;

    this.retry = config.retry
      ? { ...DEFAULT_RETRY, ...config.retry }
      : DEFAULT_RETRY;
  }

  // ── HTTP methods ──────────────────────────────────────────────────────────

  get<T>(url: string, config?: RequestConfig): Promise<Result<HttpResponse<T>, HttpClientError>> {
    return this.execute<T>('GET', url, undefined, config);
  }

  post<T>(url: string, data?: unknown, config?: RequestConfig): Promise<Result<HttpResponse<T>, HttpClientError>> {
    return this.execute<T>('POST', url, data, config);
  }

  put<T>(url: string, data?: unknown, config?: RequestConfig): Promise<Result<HttpResponse<T>, HttpClientError>> {
    return this.execute<T>('PUT', url, data, config);
  }

  patch<T>(url: string, data?: unknown, config?: RequestConfig): Promise<Result<HttpResponse<T>, HttpClientError>> {
    return this.execute<T>('PATCH', url, data, config);
  }

  delete<T>(url: string, config?: RequestConfig): Promise<Result<HttpResponse<T>, HttpClientError>> {
    return this.execute<T>('DELETE', url, undefined, config);
  }

  // ── Cancellation ──────────────────────────────────────────────────────────

  cancelRequest(key: string): void {
    this.cancelMgr.cancel(key);
    this._metrics.cancelled++;
  }

  cancelAll(): void {
    const count = this.cancelMgr.size;
    this.cancelMgr.cancelAll();
    this._metrics.cancelled += count;
  }

  // ── Observability ─────────────────────────────────────────────────────────

  getMetrics(): Readonly<HttpMetrics> {
    return { ...this._metrics };
  }

  getCircuitBreakerState() {
    return this.cb?.getState();
  }

  getCircuitBreakerMetrics() {
    return this.cb?.getMetrics();
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private async execute<T>(
    method:  string,
    url:     string,
    data:    unknown,
    config:  RequestConfig = {},
  ): Promise<Result<HttpResponse<T>, HttpClientError>> {
    this._metrics.requests++;

    const initialCtx: HttpCtx = {
      url,
      method,
      data,
      headers:       config.headers ?? {},
      params:        config.params,
      timeout:       config.timeout,
      cancelKey:     config.cancelKey,
      correlationId: config.correlationId,
    };

    // Pre-register cancel token synchronously so callers can cancel before the request fires
    if (initialCtx.cancelKey) {
      this.cancelMgr.getOrCreate(initialCtx.cancelKey);
    }

    // Pre-request middleware pipeline
    const pipelineResult = await this.pipeline.run(initialCtx);
    if (!pipelineResult.ok) {
      this._metrics.failed++;
      return fail(pipelineResult.error.cause);
    }

    const ctx = pipelineResult.value;

    // If the cancel key was cancelled during the pipeline, bail out immediately
    if (ctx.cancelKey && !this.cancelMgr.has(ctx.cancelKey)) {
      this._metrics.failed++;
      return fail({ type: 'cancelled', message: `Request ${ctx.cancelKey} cancelled` });
    }

    const cancelToken = ctx.cancelKey
      ? this.cancelMgr.getOrCreate(ctx.cancelKey).token
      : undefined;

    // Raw axios call — throws on any error
    const rawCall = () => this.callAxios<T>(ctx, cancelToken);

    // Retry wraps rawCall so transient failures are retried before the CB sees the outcome.
    // CB then wraps the full retry chain: it counts one failure only when ALL retries are
    // exhausted, preventing premature CB trips from recoverable transient errors.
    const retriedCall = (): Promise<HttpResponse<T>> =>
      this.retry.attempts > 0
        ? this.withRetry(rawCall, this.retry)
        : rawCall();

    try {
      const response = this.cb
        ? await this.cb.execute(retriedCall)
        : await retriedCall();

      if (ctx.cancelKey) this.cancelMgr.delete(ctx.cancelKey);
      this._metrics.success++;
      return ok(response);
    } catch (e) {
      if (ctx.cancelKey) this.cancelMgr.delete(ctx.cancelKey);
      if (e instanceof CircuitBreakerOpenError) {
        this._metrics.circuitOpen++;
        return fail({ type: 'circuit-open', message: e.message });
      }
      const error = this.isHttpClientError(e) ? e : this.normalizeError(e);
      this._metrics.failed++;
      return fail(error);
    }
  }

  private async callAxios<T>(ctx: HttpCtx, cancelToken?: CancelToken): Promise<HttpResponse<T>> {
    const response = await this.axiosInstance.request<T>({
      url:         ctx.url,
      method:      ctx.method,
      data:        ctx.data,
      headers:     ctx.headers,
      params:      ctx.params,
      timeout:     ctx.timeout,
      cancelToken,
    });

    return {
      data:    response.data,
      status:  response.status,
      headers: response.headers as Record<string, string>,
    };
  }

  private async withRetry<T>(
    fn:     () => Promise<T>,
    config: Required<RetryConfig>,
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= config.attempts; attempt++) {
      try {
        return await fn();
      } catch (e) {
        lastError = e;

        if (attempt === config.attempts) break;

        const error = this.isHttpClientError(e) ? e : this.normalizeError(e);
        if (!config.shouldRetry(error, attempt)) break;

        this._metrics.retried++;

        const baseDelay = config.delayMs * Math.pow(2, attempt);
        const jitter    = config.jitter ? Math.random() * config.delayMs : 0;
        const delay     = Math.min(baseDelay + jitter, config.maxDelayMs);

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  private normalizeError(error: unknown): HttpClientError {
    if (axios.isCancel(error)) {
      return {
        type:    'cancelled',
        message: (error as { message?: string }).message ?? 'Request cancelled',
      };
    }

    if (axios.isAxiosError(error)) {
      const code = error.code;
      if (code === 'ECONNABORTED' || code === 'ETIMEDOUT') {
        return { type: 'timeout', message: error.message, cause: error };
      }
      if (!error.response) {
        return { type: 'network', message: error.message, cause: error };
      }
      return {
        type:    'http',
        message: error.message,
        status:  error.response.status,
        data:    error.response.data,
        cause:   error,
      };
    }

    return { type: 'network', message: 'Unexpected error', cause: error };
  }

  private isHttpClientError(e: unknown): e is HttpClientError {
    return (
      typeof e === 'object' &&
      e !== null &&
      'type' in e &&
      'message' in e &&
      typeof (e as HttpClientError).type === 'string'
    );
  }
}
