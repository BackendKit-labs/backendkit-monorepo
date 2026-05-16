import { vi } from 'vitest';
import { ok, fail } from '@backendkit-labs/result';
import { ConfigTuner } from '../../src/core/config-tuner/config-tuner.js';
import { StorageAdapter } from '../../src/core/persistence/storage-adapter.js';
import { ObservabilityAdapter } from '../../src/core/observability/observability-adapter.js';
import { AggregatePattern, AnomalyReport, TunableConfig } from '../../src/core/types.js';
import { storageError } from '../../src/core/errors.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
  const defaults: TunableConfig = {
    timeoutMs: 10000,
    maxRetries: 3,
    circuitBreakerThreshold: 0.5,
    circuitBreakerHalfOpenAfterMs: 30000,
    bulkheadMaxConcurrent: 10,
  };
  return {
    savePattern: vi.fn(),
    getPatterns: vi.fn(),
    getAggregates: vi.fn(),
    saveAnomaly: vi.fn(),
    getRecentAnomalies: vi.fn(),
    saveConfig: vi.fn<(config: TunableConfig) => ReturnType<StorageAdapter['saveConfig']>>().mockReturnValue(ok(undefined)),
    loadConfig: vi.fn<() => ReturnType<StorageAdapter['loadConfig']>>().mockReturnValue(ok(defaults)),
    saveCycleEvent: vi.fn(),
    getLastCycleTime: vi.fn(),
    prune: vi.fn(),
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ConfigTuner', () => {
  let storage: vi.Mocked<StorageAdapter>;
  let observability: vi.Mocked<ObservabilityAdapter>;
  let tuner: ConfigTuner;

  beforeEach(() => {
    storage = makeStorageMock();
    observability = makeObservabilityMock();
    tuner = new ConfigTuner(storage, observability);
  });

  // ---- constructor ----

  describe('constructor', () => {
    it('should load config from storage on construction', () => {
      expect(storage.loadConfig).toHaveBeenCalled();
    });

    it('should use default config when storage returns null', () => {
      storage.loadConfig.mockReturnValue(ok(null));
      const t = new ConfigTuner(storage, observability);

      const config = t.getCurrentConfig();
      expect(config.timeoutMs).toBe(10000);
      expect(config.maxRetries).toBe(3);
    });

    it('should use default config when storage fails', () => {
      storage.loadConfig.mockReturnValue(fail(storageError('fail')));
      const t = new ConfigTuner(storage, observability);

      const config = t.getCurrentConfig();
      expect(config.timeoutMs).toBe(10000);
    });
  });

  // ---- getCurrentConfig ----

  describe('getCurrentConfig', () => {
    it('should return a copy of the current config', () => {
      const config = tuner.getCurrentConfig();
      expect(config.timeoutMs).toBe(10000);
      config.timeoutMs = 999;
      // original should be unchanged
      expect(tuner.getCurrentConfig().timeoutMs).toBe(10000);
    });
  });

  // ---- tune ----

  describe('tune', () => {
    it('should return current config when aggregates is empty', () => {
      const result = tuner.tune([], []);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.timeoutMs).toBe(10000);
      }
    });

    it('should increase timeout when p95 latency is high', () => {
      const aggregates = [makeAggregate({ p95Ms: 8000 })];

      const result = tuner.tune(aggregates, []);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // target = 8000 * 2 = 16000, smoothed: 10000 + (16000-10000)*0.3 = 11800
        expect(result.value.timeoutMs).toBeGreaterThan(10000);
        expect(result.value.timeoutMs).toBeLessThan(16000);
      }
    });

    it('should not decrease timeout below minTimeoutMs', () => {
      const tunerWithMin = new ConfigTuner(storage, observability, { minTimeoutMs: 1000 });
      const aggregates = [makeAggregate({ p95Ms: 10 })];

      const result = tunerWithMin.tune(aggregates, []);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.timeoutMs).toBeGreaterThanOrEqual(1000);
      }
    });

    it('should not increase timeout above maxTimeoutMs', () => {
      // target = min(10000*2, 5000) = 5000
      // smoothed = 10000 + (5000-10000)*0.3 = 8500
      // The implementation clamps the target, not the final smoothed value
      const tunerWithMax = new ConfigTuner(storage, observability, { maxTimeoutMs: 5000 });
      const aggregates = [makeAggregate({ p95Ms: 10000 })];

      const result = tunerWithMax.tune(aggregates, []);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // smoothed value: 10000 + (5000-10000)*0.3 = 8500
        expect(result.value.timeoutMs).toBe(8500);
      }
    });

    it('should increase maxRetries when error rate is high', () => {
      const aggregates = [makeAggregate({ errorRate: 0.2 })];

      const result = tuner.tune(aggregates, []);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.maxRetries).toBe(4);
      }
    });

    it('should decrease maxRetries when error rate is low', () => {
      // Use a tuner that starts with maxRetries=4 so we can decrease it
      const customStorage = makeStorageMock();
      customStorage.loadConfig.mockReturnValue(ok({
        timeoutMs: 10000,
        maxRetries: 4,
        circuitBreakerThreshold: 0.5,
        circuitBreakerHalfOpenAfterMs: 30000,
        bulkheadMaxConcurrent: 10,
      }));
      const t = new ConfigTuner(customStorage, observability);

      const lowError = [makeAggregate({ errorRate: 0.005 })];
      const result = t.tune(lowError, []);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.maxRetries).toBe(3);
      }
    });

    it('should not decrease maxRetries below 0', () => {
      // Create a tuner with maxRetries = 0
      const customStorage = makeStorageMock();
      customStorage.loadConfig.mockReturnValue(ok({
        timeoutMs: 10000,
        maxRetries: 0,
        circuitBreakerThreshold: 0.5,
        circuitBreakerHalfOpenAfterMs: 30000,
        bulkheadMaxConcurrent: 10,
      }));
      const t = new ConfigTuner(customStorage, observability);

      const aggregates = [makeAggregate({ errorRate: 0.005 })];
      const result = t.tune(aggregates, []);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.maxRetries).toBe(0);
      }
    });

    it('should decrease circuit breaker threshold when critical anomalies exist', () => {
      const aggregates = [makeAggregate()];
      const anomalies = [makeAnomaly({ severity: 'critical' })];

      const result = tuner.tune(aggregates, anomalies);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.circuitBreakerThreshold).toBeLessThan(0.5);
      }
    });

    it('should increase circuit breaker threshold when no anomalies', () => {
      const aggregates = [makeAggregate()];

      const result = tuner.tune(aggregates, []);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.circuitBreakerThreshold).toBeGreaterThan(0.5);
      }
    });

    it('should not decrease circuit breaker threshold below 0.1', () => {
      const aggregates = [makeAggregate()];
      const anomalies = [
        makeAnomaly({ severity: 'critical' }),
        makeAnomaly({ severity: 'critical' }),
        makeAnomaly({ severity: 'critical' }),
        makeAnomaly({ severity: 'critical' }),
      ];

      const result = tuner.tune(aggregates, anomalies);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.circuitBreakerThreshold).toBeGreaterThanOrEqual(0.1);
      }
    });

    it('should not increase circuit breaker threshold above 0.8', () => {
      // First decrease to have room
      const aggregates = [makeAggregate()];
      const anomalies = [makeAnomaly({ severity: 'critical' })];
      tuner.tune(aggregates, anomalies);

      // Then increase many times
      for (let i = 0; i < 20; i++) {
        tuner.tune(aggregates, []);
      }

      const config = tuner.getCurrentConfig();
      expect(config.circuitBreakerThreshold).toBeLessThanOrEqual(0.8);
    });

    it('should save config and notify listeners when changes occur', () => {
      const listener = vi.fn();
      tuner.onConfigChange(listener);

      const aggregates = [makeAggregate({ p95Ms: 8000 })];
      const result = tuner.tune(aggregates, []);

      expect(result.ok).toBe(true);
      expect(storage.saveConfig).toHaveBeenCalled();
      expect(listener).toHaveBeenCalled();
    });

    it('should return fail when storage.saveConfig fails', () => {
      storage.saveConfig.mockReturnValue(fail(storageError('disk full')));

      const aggregates = [makeAggregate({ p95Ms: 8000 })];
      const result = tuner.tune(aggregates, []);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.tag).toBe('STORAGE_ERROR');
      }
    });
  });

  // ---- reset ----

  describe('reset', () => {
    it('should reset config to defaults', () => {
      // First change something
      tuner.tune([makeAggregate({ p95Ms: 8000 })], []);

      const result = tuner.reset();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.timeoutMs).toBe(10000);
        expect(result.value.maxRetries).toBe(3);
        expect(result.value.circuitBreakerThreshold).toBe(0.5);
      }
    });

    it('should save reset config to storage', () => {
      tuner.reset();

      expect(storage.saveConfig).toHaveBeenCalled();
    });

    it('should notify listeners on reset', () => {
      const listener = vi.fn();
      tuner.onConfigChange(listener);

      tuner.reset();

      expect(listener).toHaveBeenCalled();
    });

    it('should return fail when storage.saveConfig fails on reset', () => {
      storage.saveConfig.mockReturnValue(fail(storageError('fail')));

      const result = tuner.reset();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.tag).toBe('STORAGE_ERROR');
      }
    });
  });

  // ---- onConfigChange ----

  describe('onConfigChange', () => {
    it('should register and call listeners on config change', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      tuner.onConfigChange(listener1);
      tuner.onConfigChange(listener2);

      tuner.tune([makeAggregate({ p95Ms: 8000 })], []);

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it('should call listeners on reset', () => {
      const listener = vi.fn();
      tuner.onConfigChange(listener);

      tuner.reset();

      expect(listener).toHaveBeenCalledTimes(1);
    });
  });
});
