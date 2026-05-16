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
    circuitBreaker: { failureThreshold: 50, openTimeoutMs: 30000 },
    bulkhead: { maxConcurrentCalls: 10 },
    httpClient: { timeoutMs: 10000, maxRetries: 3 },
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
      expect(config.httpClient.timeoutMs).toBe(10000);
      expect(config.httpClient.maxRetries).toBe(3);
    });

    it('should use default config when storage fails', () => {
      storage.loadConfig.mockReturnValue(fail(storageError('fail')));
      const t = new ConfigTuner(storage, observability);

      const config = t.getCurrentConfig();
      expect(config.httpClient.timeoutMs).toBe(10000);
    });
  });

  // ---- getCurrentConfig ----

  describe('getCurrentConfig', () => {
    it('should return a copy of the current config', () => {
      const config = tuner.getCurrentConfig();
      expect(config.httpClient.timeoutMs).toBe(10000);
      config.httpClient.timeoutMs = 999;
      // original should be unchanged
      expect(tuner.getCurrentConfig().httpClient.timeoutMs).toBe(10000);
    });
  });

  // ---- tune ----

  describe('tune', () => {
    it('should return current config when aggregates is empty', () => {
      const result = tuner.tune([], []);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.httpClient.timeoutMs).toBe(10000);
      }
    });

    it('should increase timeout when p95 latency is high', () => {
      const aggregates = [makeAggregate({ p95Ms: 8000 })];

      const result = tuner.tune(aggregates, []);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // target = 8000 * 2 = 16000, smoothed: 10000 + (16000-10000)*0.3 = 11800
        expect(result.value.httpClient.timeoutMs).toBeGreaterThan(10000);
        expect(result.value.httpClient.timeoutMs).toBeLessThan(16000);
      }
    });

    it('should not decrease timeout below minTimeoutMs', () => {
      const tunerWithMin = new ConfigTuner(storage, observability, { minTimeoutMs: 1000 });
      const aggregates = [makeAggregate({ p95Ms: 10 })];

      const result = tunerWithMin.tune(aggregates, []);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.httpClient.timeoutMs).toBeGreaterThanOrEqual(1000);
      }
    });

    it('should not increase timeout above maxTimeoutMs', () => {
      const tunerWithMax = new ConfigTuner(storage, observability, { maxTimeoutMs: 5000 });
      const aggregates = [makeAggregate({ p95Ms: 10000 })];

      const result = tunerWithMax.tune(aggregates, []);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // smoothed value: 10000 + (5000-10000)*0.3 = 8500
        expect(result.value.httpClient.timeoutMs).toBe(8500);
      }
    });

    it('should increase maxRetries when error rate is high', () => {
      const aggregates = [makeAggregate({ errorRate: 0.2 })];

      const result = tuner.tune(aggregates, []);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.httpClient.maxRetries).toBe(4);
      }
    });

    it('should decrease maxRetries when error rate is low', () => {
      const customStorage = makeStorageMock();
      customStorage.loadConfig.mockReturnValue(ok({
        circuitBreaker: { failureThreshold: 50, openTimeoutMs: 30000 },
        bulkhead: { maxConcurrentCalls: 10 },
        httpClient: { timeoutMs: 10000, maxRetries: 4 },
      }));
      const t = new ConfigTuner(customStorage, observability);

      const result = t.tune([makeAggregate({ errorRate: 0.005 })], []);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.httpClient.maxRetries).toBe(3);
      }
    });

    it('should not decrease maxRetries below 0', () => {
      const customStorage = makeStorageMock();
      customStorage.loadConfig.mockReturnValue(ok({
        circuitBreaker: { failureThreshold: 50, openTimeoutMs: 30000 },
        bulkhead: { maxConcurrentCalls: 10 },
        httpClient: { timeoutMs: 10000, maxRetries: 0 },
      }));
      const t = new ConfigTuner(customStorage, observability);

      const result = t.tune([makeAggregate({ errorRate: 0.005 })], []);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.httpClient.maxRetries).toBe(0);
      }
    });

    it('should decrease circuit breaker failureThreshold when critical anomalies exist', () => {
      const result = tuner.tune([makeAggregate()], [makeAnomaly({ severity: 'critical' })]);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.circuitBreaker.failureThreshold).toBeLessThan(50);
      }
    });

    it('should increase circuit breaker failureThreshold when no anomalies', () => {
      const result = tuner.tune([makeAggregate()], []);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.circuitBreaker.failureThreshold).toBeGreaterThan(50);
      }
    });

    it('should not decrease circuit breaker failureThreshold below 10', () => {
      const anomalies = Array.from({ length: 4 }, () => makeAnomaly({ severity: 'critical' }));

      const result = tuner.tune([makeAggregate()], anomalies);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.circuitBreaker.failureThreshold).toBeGreaterThanOrEqual(10);
      }
    });

    it('should not increase circuit breaker failureThreshold above 80', () => {
      tuner.tune([makeAggregate()], [makeAnomaly({ severity: 'critical' })]);

      for (let i = 0; i < 20; i++) {
        tuner.tune([makeAggregate()], []);
      }

      expect(tuner.getCurrentConfig().circuitBreaker.failureThreshold).toBeLessThanOrEqual(80);
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

    describe('cooldown', () => {
      beforeEach(() => vi.useFakeTimers());
      afterEach(() => vi.useRealTimers());

      it('should not apply a second change within the cooldown period', () => {
        const t = new ConfigTuner(storage, observability, { cooldownMs: 5000 });
        const aggregates = [makeAggregate({ p95Ms: 8000 })];

        t.tune(aggregates, []);
        expect(storage.saveConfig).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(3000); // still within 5s cooldown
        t.tune(aggregates, []);
        expect(storage.saveConfig).toHaveBeenCalledTimes(1); // not applied

        vi.advanceTimersByTime(3000); // 6s total — past cooldown
        t.tune(aggregates, []);
        expect(storage.saveConfig).toHaveBeenCalledTimes(2); // applied
      });
    });
  });

  // ---- reset ----

  describe('reset', () => {
    it('should reset config to defaults', () => {
      tuner.tune([makeAggregate({ p95Ms: 8000 })], []);

      const result = tuner.reset();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.httpClient.timeoutMs).toBe(10000);
        expect(result.value.httpClient.maxRetries).toBe(3);
        expect(result.value.circuitBreaker.failureThreshold).toBe(50);
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

    it('should return an unsubscribe function that stops future notifications', () => {
      const listener = vi.fn();
      const unsub = tuner.onConfigChange(listener);

      tuner.tune([makeAggregate({ p95Ms: 8000 })], []);
      expect(listener).toHaveBeenCalledTimes(1);

      unsub();
      tuner.reset(); // fires listeners — but listener was unsubscribed
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });
});
