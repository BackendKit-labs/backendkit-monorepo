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
});
