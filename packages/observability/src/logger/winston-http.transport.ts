import TransportStream, { TransportStreamOptions } from 'winston-transport';
import axios, { AxiosInstance }                    from 'axios';
import * as http                                   from 'node:http';
import * as https                                  from 'node:https';
import { Logger }                                  from '@nestjs/common';
import { TransportCircuitBreaker }                 from '../internal/transport-circuit-breaker.js';

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

  /** Circuit breaker: consecutive failures before OPEN (default 5). */
  cbFailureThreshold?: number;

  /** Circuit breaker: recovery window in ms (default 30 000). */
  cbResetMs?: number;
}

interface LogEntry {
  level:   string;
  message: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export class WinstonHttpTransport extends TransportStream {
  private readonly client:  AxiosInstance;
  private readonly cb:      TransportCircuitBreaker;
  private readonly logger:  Logger;
  private readonly buffer:  LogEntry[] = [];
  private readonly batchSize:    number;
  private readonly maxBufferSize: number;
  private readonly flushTimer:   ReturnType<typeof setInterval>;

  constructor(opts: WinstonHttpTransportOptions) {
    super(opts);

    this.logger       = new Logger(WinstonHttpTransport.name);
    this.batchSize    = opts.batchSize    ?? 100;
    this.maxBufferSize = opts.maxBufferSize ?? 2_000;

    const keepAlive = new http.Agent({ keepAlive: true });
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

    this.cb = new TransportCircuitBreaker(
      opts.cbFailureThreshold ?? 5,
      opts.cbResetMs          ?? 30_000,
      this.logger,
      'WinstonHttpTransport',
    );

    this.flushTimer = setInterval(
      () => { void this.flush(); },
      opts.flushIntervalMs ?? 5_000,
    );
    this.flushTimer.unref?.();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  override log(info: any, callback: () => void): void {
    setImmediate(() => this.emit('logged', info));

    if (this.buffer.length < this.maxBufferSize) {
      this.buffer.push(info as LogEntry);
    } else {
      this.logger.warn('[WinstonHttpTransport] buffer full — dropping log entry');
    }

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
    if (this.cb.isOpen) return;

    const batch = this.buffer.splice(0, this.batchSize);

    try {
      await this.client.post('', batch);
      this.cb.recordSuccess();
    } catch (err) {
      this.cb.recordFailure();
      this.logger.warn(
        `[WinstonHttpTransport] flush failed — re-queueing ${batch.length} entries`,
        err,
      );
      // Re-queue at the front (oldest-first) if there is still room
      const room = this.maxBufferSize - this.buffer.length;
      if (room > 0) {
        this.buffer.unshift(...batch.slice(0, room));
      }
    }
  }
}
