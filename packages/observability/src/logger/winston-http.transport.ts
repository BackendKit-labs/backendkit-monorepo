import { Logger }                                      from '@nestjs/common';
import TransportStream, { TransportStreamOptions }    from 'winston-transport';
import axios, { AxiosInstance }                        from 'axios';
import * as http                                       from 'node:http';
import * as https                                      from 'node:https';
import {
  CircuitBreaker,
  CircuitBreakerConfig,
  CircuitBreakerOpenError,
} from '@backendkit-labs/circuit-breaker';

export interface WinstonHttpTransportOptions extends TransportStreamOptions {
  /** Full URL of the log-ingest endpoint. */
  url: string;

  /** Bearer token sent in `Authorization` header. */
  authToken?: string;

  /** Additional static headers merged into every request. */
  headers?: Record<string, string>;

  /** Flush batch when it reaches this many entries (default 100). */
  batchSize?: number;

  /** Maximum entries held in the in-memory buffer (default 2000). */
  maxBufferSize?: number;

  /** Flush interval in ms — also flushes on `close()` (default 5000). */
  flushIntervalMs?: number;

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

interface LogEntry {
  level:   string;
  message: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

const TRANSPORT_CB_DEFAULTS: Omit<CircuitBreakerConfig, 'name' | 'isFailure'> = {
  failureThreshold:  60,
  slowCallThreshold: 100,
  slowCallDurationMs: 60_000,
  minimumCalls:      3,
  slidingWindowSize: 5,
  halfOpenMaxCalls:  1,
  openTimeoutMs:     30_000,
};

export class WinstonHttpTransport extends TransportStream {
  private readonly client:       AxiosInstance;
  private readonly cb:           CircuitBreaker;
  private buffer:       LogEntry[] = [];
  private readonly batchSize:    number;
  private readonly maxBufferSize: number;
  private readonly maxEntryAgeMs = 300_000; // 5 min
  private readonly fallbackLogger = new Logger(WinstonHttpTransport.name);
  private readonly retryCounts  = new WeakMap<LogEntry, number>();
  private readonly entryTimes   = new WeakMap<LogEntry, number>();
  private readonly maxRetries = 5;
  private readonly flushTimer:   ReturnType<typeof setInterval>;

  constructor(opts: WinstonHttpTransportOptions) {
    super(opts);

    this.batchSize     = opts.batchSize    ?? 100;
    this.maxBufferSize = opts.maxBufferSize ?? 2_000;

    const keepAlive      = new http.Agent({ keepAlive: true });
    const keepAliveHttps = new https.Agent({ keepAlive: true });

    this.client = axios.create({
      baseURL: opts.url,
      timeout: opts.timeoutMs ?? 5_000,
      httpAgent:  keepAlive,
      httpsAgent: keepAliveHttps,
      headers: {
        'Content-Type': 'application/json',
        ...(opts.authToken ? { Authorization: `Bearer ${opts.authToken}` } : {}),
        ...opts.headers,
      },
    });

    // Redact sensitive headers from error output
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.config?.headers?.Authorization) {
          error.config.headers.Authorization = 'Bearer ***REDACTED***';
        }
        return Promise.reject(error);
      },
    );

    this.cb = new CircuitBreaker({
      ...TRANSPORT_CB_DEFAULTS,
      ...opts.circuitBreaker,
      name:      'WinstonHttpTransport',
      isFailure: (error: unknown) => {
        const status = (error as { response?: { status?: number } }).response?.status;
        return status !== undefined ? status >= 400 : true;
      },
    });

    this.flushTimer = setInterval(
      () => { void this.flush(); },
      opts.flushIntervalMs ?? 5_000,
    );
    this.flushTimer.unref?.();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  override log(info: any, callback: () => void): void {
    this.emit('logged', info);

    if (this.buffer.length < this.maxBufferSize) {
      const entry = { ...info } as LogEntry;
      this.entryTimes.set(entry, Date.now());
      this.buffer.push(entry);
    }
    // silently drop when full — buffer-full warn would cause infinite recursion

    if (this.buffer.length >= this.batchSize) {
      void this.flush();
    }

    callback();
  }

  /** Flush remaining buffer on graceful shutdown. */
  override async close(): Promise<void> {
    clearInterval(this.flushTimer);
    await this.flush();
  }

  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    // Discard entries older than maxEntryAgeMs
    const now = Date.now();
    this.buffer = this.buffer.filter(
      (e) => now - (this.entryTimes.get(e) ?? now) < this.maxEntryAgeMs,
    );

    const batch = this.buffer.splice(0, this.batchSize);

    try {
      await this.cb.execute(() => this.client.post('', batch));
    } catch (err) {
      // Re-queue with retry limit to prevent infinite re-enqueue
      const retryable = batch.filter(entry => {
        const retries = this.retryCounts.get(entry) ?? 0;
        if (retries >= this.maxRetries) return false;
        this.retryCounts.set(entry, retries + 1);
        return true;
      });
      const room = this.maxBufferSize - this.buffer.length;
      if (room > 0) this.buffer.unshift(...retryable.slice(0, room));

      if (!(err instanceof CircuitBreakerOpenError)) {
        this.fallbackLogger.warn(`flush failed — re-queued ${retryable.length}/${batch.length} entries`, (err as Error).message);
      }
    }
  }
}
