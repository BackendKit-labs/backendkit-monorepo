import { Injectable, Inject, Optional, OnModuleDestroy, Logger } from '@nestjs/common';
import axios, { AxiosInstance }                                   from 'axios';
import * as http                                                  from 'node:http';
import * as https                                                 from 'node:https';
import {
  CircuitBreaker,
  CircuitBreakerConfig,
  CircuitBreakerOpenError,
  CircuitBreakerState,
}                                                                 from '@backendkit-labs/circuit-breaker';
import { CorrelationIdService }                                   from '../correlation/correlation.service.js';
import { OBSERVABILITY_OPTIONS }                                  from '../observability.constants.js';
import { ObservabilityOptions, MetricEvent }                      from '../observability.types.js';

const TRANSPORT_CB_DEFAULTS: Omit<CircuitBreakerConfig, 'name' | 'isFailure'> = {
  failureThreshold:  60,
  slowCallThreshold: 100,
  slowCallDurationMs: 60_000,
  minimumCalls:      3,
  slidingWindowSize: 5,
  halfOpenMaxCalls:  1,
  openTimeoutMs:     30_000,
};

@Injectable()
export class MetricsService implements OnModuleDestroy {
  private readonly client:        AxiosInstance | null = null;
  private readonly cb:            CircuitBreaker | null = null;
  private readonly logger =       new Logger(MetricsService.name);
  private buffer:        MetricEvent[] = [];
  private readonly maxBufferSize: number = 5_000;
  private readonly maxEntryAgeMs = 300_000; // 5 min
  private readonly retryCounts = new WeakMap<MetricEvent, number>();
  private readonly maxRetries = 5;
  private readonly flushTimer:    ReturnType<typeof setInterval> | null = null;

  constructor(
    @Inject(OBSERVABILITY_OPTIONS)
    private readonly opts: ObservabilityOptions,
    @Optional()
    private readonly correlationSvc?: CorrelationIdService,
  ) {
    if (!opts.metrics) return;

    const m = opts.metrics;
    this.maxBufferSize = m.maxBufferSize ?? 5_000;

    const keepAlive      = new http.Agent({ keepAlive: true });
    const keepAliveHttps = new https.Agent({ keepAlive: true });

    this.client = axios.create({
      baseURL: m.url,
      timeout: m.timeoutMs ?? 5_000,
      httpAgent:  keepAlive,
      httpsAgent: keepAliveHttps,
      headers: {
        'Content-Type': 'application/json',
        ...(m.authToken ? { Authorization: `Bearer ${m.authToken}` } : {}),
        ...m.headers,
      },
    });

    this.cb = new CircuitBreaker({
      ...TRANSPORT_CB_DEFAULTS,
      ...m.circuitBreaker,
      name:      'MetricsService',
      isFailure: (error: unknown) => {
        const status = (error as { response?: { status?: number } }).response?.status;
        return status !== undefined ? status >= 400 : true;
      },
      onStateChange: (from, to, metrics) => {
        if (to === CircuitBreakerState.OPEN) {
          this.logger.warn(
            `[MetricsService] circuit breaker OPEN — pausing metric sends for ${(m.circuitBreaker?.openTimeoutMs ?? TRANSPORT_CB_DEFAULTS.openTimeoutMs) / 1_000}s`,
            metrics,
          );
        } else if (to === CircuitBreakerState.CLOSED && from !== CircuitBreakerState.HALF_OPEN) {
          this.logger.log(`[MetricsService] circuit breaker CLOSED — recovered`);
        }
        m.circuitBreaker?.onStateChange?.(from, to, metrics);
      },
    });

    this.flushTimer = setInterval(
      () => { void this.flush(); },
      m.flushIntervalMs ?? 10_000,
    );
    this.flushTimer.unref?.();
  }

  /**
   * Enqueue a metric event. Fire-and-forget; batched and sent on the next
   * flush interval or when the buffer reaches `maxBufferSize`.
   */
  record(
    name: string,
    value: number,
    options?: { unit?: string; tags?: Record<string, string> },
  ): void {
    if (!this.client) return;

    if (this.buffer.length >= this.maxBufferSize) {
      this.logger.warn('[MetricsService] buffer full — dropping metric');
      return;
    }

    this.buffer.push({
      name,
      value,
      unit:          options?.unit,
      tags:          options?.tags,
      timestamp:     new Date().toISOString(),
      serviceName:   this.opts.serviceName,
      environment:   this.opts.environment ?? 'production',
      correlationId: this.correlationSvc?.getOrUndefined(),
    });
  }

  /** Flush on graceful shutdown. */
  async onModuleDestroy(): Promise<void> {
    if (this.flushTimer) clearInterval(this.flushTimer);
    try {
      await this.flush();
    } catch {
      // Flush already handles errors internally; nothing to do here
    }
  }

  private async flush(): Promise<void> {
    if (!this.client || this.buffer.length === 0) return;

    // Discard entries older than maxEntryAgeMs
    const now = Date.now();
    this.buffer = this.buffer.filter(
      (e) => now - new Date(e.timestamp).getTime() < this.maxEntryAgeMs,
    );

    const batch = this.buffer.splice(0, 500);

    try {
      await this.cb!.execute(() => this.client!.post('', batch));
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
        this.logger.warn(
          `[MetricsService] flush failed — re-queueing ${retryable.length}/${batch.length} events`,
          (err as Error).message,
        );
      }
    }
  }
}
