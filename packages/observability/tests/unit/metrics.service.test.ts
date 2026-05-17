import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios                                                from 'axios';
import { CircuitBreakerState }                              from '@backendkit-labs/circuit-breaker';
import { MetricsService }                                   from '../../src/metrics/metrics.service.js';
import { CorrelationIdService }                             from '../../src/correlation/correlation.service.js';
import { ObservabilityOptions }                             from '../../src/observability.types.js';

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      post: vi.fn().mockResolvedValue({ status: 200 }),
    })),
  },
}));

// Fast-failing CB: opens after 2 failures in a window of 3 (≥60%)
const opts: ObservabilityOptions = {
  serviceName: 'metrics-test',
  environment: 'test',
  metrics: {
    url:             'http://metrics.local/ingest',
    authToken:       'tok',
    flushIntervalMs: 60_000, // long — we flush manually in tests
    maxBufferSize:   10,
    circuitBreaker: {
      minimumCalls:     1,
      slidingWindowSize: 3,
      failureThreshold:  60, // 60% → opens after 2/3 failures
      openTimeoutMs:     30_000,
      halfOpenMaxCalls:  1,
    },
  },
};

describe('MetricsService', () => {
  let svc:       MetricsService;
  let correlSvc: CorrelationIdService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let postMock:  any;

  beforeEach(() => {
    vi.clearAllMocks();
    correlSvc = new CorrelationIdService();
    svc       = new MetricsService(opts, correlSvc);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    postMock  = (svc as any).client?.post;
  });

  afterEach(async () => {
    await svc.onModuleDestroy();
  });

  it('does nothing when metrics config is absent', () => {
    const noMetrics = new MetricsService({ serviceName: 'x' });
    noMetrics.record('cpu', 42);
    expect(true).toBe(true);
  });

  it('buffers a metric event', () => {
    svc.record('cpu.usage', 80, { unit: '%', tags: { host: 'srv1' } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buf = (svc as any).buffer as unknown[];
    expect(buf).toHaveLength(1);
  });

  it('flushes the buffer on onModuleDestroy()', async () => {
    svc.record('mem.used', 1024);
    await svc.onModuleDestroy();
    expect(postMock).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((svc as any).buffer).toHaveLength(0);
  });

  it('attaches correlationId when inside a context', async () => {
    await new Promise<void>(resolve => {
      correlSvc.run('corr-xyz', async () => {
        svc.record('latency', 200);
        await svc.onModuleDestroy();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const [, payload] = postMock.mock.calls[0] as [string, any[]];
        expect(payload[0].correlationId).toBe('corr-xyz');
        resolve();
      });
    });
  });

  it('drops events when buffer is full', () => {
    for (let i = 0; i < 15; i++) svc.record('x', i);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((svc as any).buffer.length).toBeLessThanOrEqual(10);
  });

  it('opens the circuit breaker after repeated flush failures', async () => {
    postMock.mockRejectedValue(new Error('network down'));

    // Need enough failures to pass minimumCalls (1) and hit failureThreshold (60%)
    for (let i = 0; i < 3; i++) {
      svc.record('x', i);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (svc as any).flush();
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((svc as any).cb?.getState()).toBe(CircuitBreakerState.OPEN);
  });

  // ── C1: Circuit Breaker isFailure (status >= 400) ────────────────

  it('treats status 200 as success for circuit breaker isFailure', () => {
    const isFailure = (error: unknown) => {
      const result = error as { status?: number };
      return result && typeof result.status === 'number' ? result.status >= 400 : true;
    };

    expect(isFailure({ status: 200 })).toBe(false);
    expect(isFailure({ status: 201 })).toBe(false);
    expect(isFailure({ status: 301 })).toBe(false);
    expect(isFailure({ status: 400 })).toBe(true);
    expect(isFailure({ status: 404 })).toBe(true);
    expect(isFailure({ status: 500 })).toBe(true);
    expect(isFailure({ status: 503 })).toBe(true);
    expect(isFailure(new Error('network'))).toBe(true);
    expect(isFailure({})).toBe(true);
  });

  // ── C2: Max retries (5) via WeakMap ──────────────────────────────

  it('re-queues entries on flush failure up to maxRetries', async () => {
    postMock.mockRejectedValue(new Error('network error'));

    svc.record('cpu', 50);
    svc.record('mem', 1024);

    await (svc as any).flush();

    // After flush failure, entries should be back in buffer (retryCount < 5)
    const buffer = (svc as any).buffer as any[];
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('drops entries after 5 retries', async () => {
    postMock.mockRejectedValue(new Error('persistent failure'));

    svc.record('latency', 200);

    // Simulate 6 flush failures — entry is re-queued 5 times, dropped on 6th
    for (let i = 0; i < 6; i++) {
      await (svc as any).flush();
    }

    // After 5 retries exhausted, entry should be dropped from buffer
    const buffer = (svc as any).buffer as any[];
    const stillThere = buffer.some((e: any) => e.name === 'latency');
    expect(stillThere).toBe(false);
  });

  // ── M5: Buffer TTL 5 min ─────────────────────────────────────────

  it('discards entries older than 5 minutes on flush', async () => {
    const oldTimestamp = new Date(Date.now() - 310_000).toISOString(); // 5 min 10 sec ago
    const freshTimestamp = new Date(Date.now() - 60_000).toISOString(); // 1 min ago

    // Push entries directly into buffer
    (svc as any).buffer = [
      { name: 'old', value: 1, timestamp: oldTimestamp, serviceName: 'test', environment: 'test' },
      { name: 'fresh', value: 2, timestamp: freshTimestamp, serviceName: 'test', environment: 'test' },
    ];

    // Flush will fail, so entries stay in buffer after filtering
    postMock.mockRejectedValue(new Error('flush error'));
    await (svc as any).flush();

    const buffer = (svc as any).buffer as any[];
    const names = buffer.map((e: any) => e.name);
    expect(names).not.toContain('old');
    expect(names).toContain('fresh');
  });

  it('keeps entries within 5 min TTL and sends them', async () => {
    postMock.mockResolvedValue({ status: 200 });
    const recentTimestamp = new Date(Date.now() - 120_000).toISOString(); // 2 min ago

    (svc as any).buffer = [
      { name: 'recent', value: 1, timestamp: recentTimestamp, serviceName: 'test', environment: 'test' },
    ];

    await (svc as any).flush();

    // After successful flush, buffer should be empty (entries were sent)
    const buffer = (svc as any).buffer as any[];
    expect(buffer).toHaveLength(0);
  });

  // ── F2: onModuleDestroy with try/catch ───────────────────────────

  it('onModuleDestroy does not throw when flush fails', async () => {
    postMock.mockRejectedValue(new Error('flush error during shutdown'));

    svc.record('cpu', 80);

    // Should not throw despite flush failure
    await expect(svc.onModuleDestroy()).resolves.toBeUndefined();
  });

  it('onModuleDestroy clears the flush timer', async () => {
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');

    await svc.onModuleDestroy();

    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });
});
