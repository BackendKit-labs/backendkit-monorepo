import { vi } from 'vitest';
import { ok, fail } from '@backendkit-labs/result';
import { FeedbackLoop } from '../../src/core/feedback-loop/feedback-loop.js';
import { IPatternRegistry } from '../../src/core/pattern-registry/types.js';
import { IAnomalyDetector } from '../../src/core/anomaly-detector/types.js';
import { IConfigTuner } from '../../src/core/config-tuner/types.js';
import { StorageAdapter } from '../../src/core/persistence/storage-adapter.js';
import { ObservabilityAdapter } from '../../src/core/observability/observability-adapter.js';
import {
  EndpointPattern,
  AggregatePattern,
  AnomalyReport,
  TunableConfig,
  LearningCycleEvent,
} from '../../src/core/types.js';
import { storageError } from '../../src/core/errors.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makePattern = (overrides: Partial<EndpointPattern> = {}): EndpointPattern => ({
  method: 'GET',
  path: '/api/users',
  statusCode: 200,
  durationMs: 100,
  timestamp: new Date(),
  ...overrides,
});

const makeAggregate = (overrides: Partial<AggregatePattern> = {}): AggregatePattern => ({
  method: 'GET',
  path: '/api/users',
  windowStart: new Date(),
  windowEnd: new Date(),
  count: 100,
  avgDurationMs: 100,
  p50Ms: 90,
  p95Ms: 200,
  p99Ms: 300,
  errorCount: 0,
  errorRate: 0,
  ...overrides,
});

const makeAnomaly = (overrides: Partial<AnomalyReport> = {}): AnomalyReport => ({
  id: 'anomaly-1',
  endpoint: '/api/users',
  method: 'GET',
  severity: 'high',
  metric: 'latency',
  expectedValue: 100,
  actualValue: 1000,
  deviation: 5,
  detectedAt: new Date(),
  ...overrides,
});

const makeStorageMock = () => {
  const patterns: EndpointPattern[] = Array.from({ length: 15 }, () => makePattern());
  return {
    savePattern: vi.fn(),
    getPatterns: vi.fn<() => ReturnType<StorageAdapter['getPatterns']>>().mockReturnValue(ok(patterns)),
    getAggregates: vi.fn<() => ReturnType<StorageAdapter['getAggregates']>>().mockReturnValue(ok([])),
    saveAnomaly: vi.fn<() => ReturnType<StorageAdapter['saveAnomaly']>>().mockReturnValue(ok(undefined)),
    getRecentAnomalies: vi.fn(),
    saveConfig: vi.fn<() => ReturnType<StorageAdapter['saveConfig']>>().mockReturnValue(ok(undefined)),
    loadConfig: vi.fn<() => ReturnType<StorageAdapter['loadConfig']>>().mockReturnValue(ok(null)),
    saveCycleEvent: vi.fn<() => ReturnType<StorageAdapter['saveCycleEvent']>>().mockReturnValue(ok(undefined)),
    getLastCycleTime: vi.fn(),
    prune: vi.fn<() => ReturnType<StorageAdapter['prune']>>().mockReturnValue(ok(0)),
  } as vi.Mocked<StorageAdapter>;
};

const makeObservabilityMock = (): vi.Mocked<ObservabilityAdapter> => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  incrementMetric: vi.fn(),
  gaugeMetric: vi.fn(),
  histogramMetric: vi.fn(),
});

const makePatternRegistryMock = () => ({
  record: vi.fn(),
  getAggregates: vi.fn<() => ReturnType<IPatternRegistry['getAggregates']>>().mockReturnValue(ok([makeAggregate()])),
  getHistory: vi.fn(),
  getStats: vi.fn(),
} as vi.Mocked<IPatternRegistry>);

const makeAnomalyDetectorMock = () => ({
  analyze: vi.fn(),
  batchAnalyze: vi.fn<() => ReturnType<IAnomalyDetector['batchAnalyze']>>().mockReturnValue(ok([])),
} as vi.Mocked<IAnomalyDetector>);

const makeConfigTunerMock = () => {
  const currentConfig: TunableConfig = {
    circuitBreaker: { failureThreshold: 50, openTimeoutMs: 30000 },
    bulkhead: { maxConcurrentCalls: 10 },
    httpClient: { timeoutMs: 10000, maxRetries: 3 },
  };
  return {
    getCurrentConfig: vi.fn<() => TunableConfig>().mockReturnValue({ ...currentConfig }),
    tune: vi.fn<() => ReturnType<IConfigTuner['tune']>>().mockReturnValue(ok({ ...currentConfig })),
    reset: vi.fn(),
    onConfigChange: vi.fn(),
  } as vi.Mocked<IConfigTuner>;
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FeedbackLoop', () => {
  let storage: vi.Mocked<StorageAdapter>;
  let observability: vi.Mocked<ObservabilityAdapter>;
  let patternRegistry: vi.Mocked<IPatternRegistry>;
  let anomalyDetector: vi.Mocked<IAnomalyDetector>;
  let configTuner: vi.Mocked<IConfigTuner>;
  let loop: FeedbackLoop;

  beforeEach(() => {
    storage = makeStorageMock();
    observability = makeObservabilityMock();
    patternRegistry = makePatternRegistryMock();
    anomalyDetector = makeAnomalyDetectorMock();
    configTuner = makeConfigTunerMock();
    loop = new FeedbackLoop(
      patternRegistry,
      anomalyDetector,
      configTuner,
      storage,
      observability,
    );
  });

  // ---- runOnce ----

  describe('runOnce', () => {
    it('should complete a full cycle and return a LearningCycleEvent', async () => {
      const result = await loop.runOnce();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.cycleId).toBeDefined();
        expect(result.value.patternsProcessed).toBe(15);
        expect(result.value.anomaliesFound).toBe(0);
        expect(result.value.durationMs).toBeGreaterThanOrEqual(0);
      }
    });

    it('should skip tuning when insufficient samples', async () => {
      storage.getPatterns.mockReturnValue(ok([makePattern()])); // only 1 sample

      const result = await loop.runOnce();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.patternsProcessed).toBe(1);
        expect(result.value.anomaliesFound).toBe(0);
        expect(result.value.configChanges).toEqual({});
      }
      // Should NOT have called downstream services
      expect(patternRegistry.getAggregates).not.toHaveBeenCalled();
      expect(anomalyDetector.batchAnalyze).not.toHaveBeenCalled();
      expect(configTuner.tune).not.toHaveBeenCalled();
    });

    it('should propagate error when storage.getPatterns fails', async () => {
      storage.getPatterns.mockReturnValue(fail(storageError('db down')));

      const result = await loop.runOnce();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.tag).toBe('STORAGE_ERROR');
      }
    });

    it('should propagate error when patternRegistry.getAggregates fails', async () => {
      patternRegistry.getAggregates.mockReturnValue(fail(storageError('fail')));

      const result = await loop.runOnce();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.tag).toBe('STORAGE_ERROR');
      }
    });

    it('should propagate error when anomalyDetector.batchAnalyze fails', async () => {
      anomalyDetector.batchAnalyze.mockReturnValue(fail({
        tag: 'ANOMALY_DETECTION_FAILED',
        message: 'analysis error',
      } as any));

      const result = await loop.runOnce();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.tag).toBe('ANOMALY_DETECTION_FAILED');
      }
    });

    it('should propagate error when configTuner.tune fails', async () => {
      configTuner.tune.mockReturnValue(fail(storageError('tune failed')));

      const result = await loop.runOnce();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.tag).toBe('STORAGE_ERROR');
      }
    });

    it('should propagate error when storage.saveCycleEvent fails (H2)', async () => {
      storage.saveCycleEvent.mockReturnValue(fail(storageError('persist failed')));

      const result = await loop.runOnce();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.tag).toBe('STORAGE_ERROR');
        expect(result.error.message).toBe('persist failed');
      }
    });

    it('should persist anomalies detected during the cycle', async () => {
      const anomaly = makeAnomaly();
      anomalyDetector.batchAnalyze.mockReturnValue(ok([anomaly]));

      await loop.runOnce();

      expect(storage.saveAnomaly).toHaveBeenCalledWith(anomaly);
    });

    it('should log a warning when saveAnomaly fails instead of silently discarding', async () => {
      anomalyDetector.batchAnalyze.mockReturnValue(ok([makeAnomaly()]));
      storage.saveAnomaly.mockReturnValue(fail(storageError('disk full')));

      await loop.runOnce();

      expect(observability.warn).toHaveBeenCalledWith(
        'Failed to persist anomaly',
        expect.objectContaining({ error: expect.objectContaining({ tag: 'STORAGE_ERROR' }) }),
      );
    });

    it('should pass the same windowEnd to getPatterns and getAggregates', async () => {
      await loop.runOnce();

      const [, windowEnd] = storage.getPatterns.mock.calls[0];
      const [, aggWindowEnd] = patternRegistry.getAggregates.mock.calls[0];
      expect(windowEnd).toEqual(aggWindowEnd);
    });

    it('should report configChanges when tune returns a different config', async () => {
      const prev: TunableConfig = {
        circuitBreaker: { failureThreshold: 50, openTimeoutMs: 30000 },
        bulkhead: { maxConcurrentCalls: 10 },
        httpClient: { timeoutMs: 10000, maxRetries: 3 },
      };
      const next: TunableConfig = {
        circuitBreaker: { failureThreshold: 40, openTimeoutMs: 30000 },
        bulkhead: { maxConcurrentCalls: 10 },
        httpClient: { timeoutMs: 10000, maxRetries: 3 },
      };

      configTuner.getCurrentConfig.mockReturnValue(prev);
      configTuner.tune.mockReturnValue(ok(next));

      const result = await loop.runOnce();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.configChanges).toEqual({
          circuitBreaker: { failureThreshold: 40, openTimeoutMs: 30000 },
        });
      }
    });

    it('should report empty configChanges when config did not change', async () => {
      const config: TunableConfig = {
        circuitBreaker: { failureThreshold: 50, openTimeoutMs: 30000 },
        bulkhead: { maxConcurrentCalls: 10 },
        httpClient: { timeoutMs: 10000, maxRetries: 3 },
      };

      configTuner.getCurrentConfig.mockReturnValue(config);
      configTuner.tune.mockReturnValue(ok({ ...config, circuitBreaker: { ...config.circuitBreaker } }));

      const result = await loop.runOnce();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.configChanges).toEqual({});
      }
    });

    it('should call cycle listeners with the cycle event', async () => {
      const listener = vi.fn();
      loop.onCycle(listener);

      const result = await loop.runOnce();

      expect(result.ok).toBe(true);
      expect(listener).toHaveBeenCalledTimes(1);
      if (result.ok) {
        expect(listener).toHaveBeenCalledWith(result.value);
      }
    });

    it('should emit observability metrics on completion', async () => {
      await loop.runOnce();

      expect(observability.info).toHaveBeenCalledWith(
        'Feedback cycle completed',
        expect.objectContaining({ patternsProcessed: 15 }),
      );
      expect(observability.histogramMetric).toHaveBeenCalledWith(
        'cycle.duration_ms',
        expect.any(Number),
      );
      expect(observability.gaugeMetric).toHaveBeenCalledWith(
        'cycle.patterns_count',
        15,
      );
    });
  });

  // ---- start / stop ----

  describe('start', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should start the interval and run cycles', () => {
      loop.start(1000);

      expect(observability.info).toHaveBeenCalledWith(
        'Feedback loop started',
        { intervalMs: 1000 },
      );
      expect(loop.isRunning()).toBe(true);
    });

    it('should warn when starting an already running loop', () => {
      loop.start(1000);
      loop.start(2000);

      expect(observability.warn).toHaveBeenCalledWith(
        'Feedback loop already running, ignoring start',
      );
    });

    it('should run cycles on each interval tick', async () => {
      loop.start(1000);

      // advanceTimersByTimeAsync drains microtasks between ticks, so isProcessing
      // resets to false before each subsequent tick and all 3 run.
      await vi.advanceTimersByTimeAsync(3000);

      // Should have run 3 times (at 1000ms, 2000ms, 3000ms)
      expect(storage.getPatterns).toHaveBeenCalledTimes(3);
    });

    it('should skip a tick when the previous cycle is still running', () => {
      const runOnce = vi.spyOn(loop, 'runOnce').mockReturnValue(new Promise(() => {}));

      loop.start(1000);
      vi.advanceTimersByTime(2500); // 2 ticks: 1000ms and 2000ms

      // First tick started runOnce; second tick found isProcessing=true and skipped
      expect(runOnce).toHaveBeenCalledTimes(1);
      expect(observability.warn).toHaveBeenCalledWith('Skipping cycle: previous cycle still running');
    });
  });

  describe('stop', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should stop the interval', () => {
      loop.start(1000);
      loop.stop();

      expect(loop.isRunning()).toBe(false);
      expect(observability.info).toHaveBeenCalledWith('Feedback loop stopped');
    });

    it('should warn when stopping a non-running loop', () => {
      loop.stop();

      expect(observability.warn).toHaveBeenCalledWith(
        'Feedback loop not running, ignoring stop',
      );
    });

    it('should not run cycles after stop', () => {
      loop.start(1000);
      loop.stop();

      vi.advanceTimersByTime(3000);

      // No calls because interval was cleared before first tick
      expect(storage.getPatterns).not.toHaveBeenCalled();
    });
  });

  describe('isRunning', () => {
    it('should return false initially', () => {
      expect(loop.isRunning()).toBe(false);
    });

    it('should return true after start', () => {
      loop.start(1000);
      expect(loop.isRunning()).toBe(true);
    });

    it('should return false after stop', () => {
      loop.start(1000);
      loop.stop();
      expect(loop.isRunning()).toBe(false);
    });
  });

  // ---- onCycle ----

  describe('onCycle', () => {
    it('should register a listener that gets called on cycle completion', async () => {
      const listener = vi.fn();
      loop.onCycle(listener);

      await loop.runOnce();

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should support multiple listeners', async () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      loop.onCycle(listener1);
      loop.onCycle(listener2);

      await loop.runOnce();

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it('should return an unsubscribe function that stops future notifications', async () => {
      const listener = vi.fn();
      const unsub = loop.onCycle(listener);

      await loop.runOnce();
      expect(listener).toHaveBeenCalledTimes(1);

      unsub();
      await loop.runOnce();
      expect(listener).toHaveBeenCalledTimes(1); // not called again
    });
  });
});
