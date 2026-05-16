import { InMemoryStorage } from '../../src/core/persistence/in-memory-storage.js';
import {
  EndpointPattern,
  AggregatePattern,
  AnomalyReport,
  TunableConfig,
  LearningCycleEvent,
} from '../../src/core/types.js';

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

const makeCycleEvent = (overrides: Partial<LearningCycleEvent> = {}): LearningCycleEvent => ({
  cycleId: 'cycle-1',
  timestamp: new Date(),
  patternsProcessed: 10,
  anomaliesFound: 1,
  configChanges: { timeoutMs: 5000 },
  durationMs: 100,
  ...overrides,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('InMemoryStorage', () => {
  let storage: InMemoryStorage;

  beforeEach(() => {
    storage = new InMemoryStorage();
  });

  // ---- savePattern / getPatterns ----

  describe('savePattern and getPatterns', () => {
    it('should save and retrieve patterns within a time window', () => {
      const now = new Date();
      const old = new Date(now.getTime() - 60_000);
      const veryOld = new Date(now.getTime() - 120_000);

      storage.savePattern(makePattern({ timestamp: now }));
      storage.savePattern(makePattern({ timestamp: old }));
      storage.savePattern(makePattern({ timestamp: veryOld }));

      const result = storage.getPatterns(new Date(now.getTime() - 90_000), now);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(2);
      }
    });

    it('should return empty array when no patterns match the window', () => {
      const now = new Date();
      storage.savePattern(makePattern({ timestamp: now }));

      const result = storage.getPatterns(new Date(now.getTime() + 60_000), new Date(now.getTime() + 120_000));

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual([]);
      }
    });

    it('should return empty array when no patterns exist', () => {
      const result = storage.getPatterns(new Date(0), new Date());

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual([]);
      }
    });
  });

  // ---- getAggregates ----

  describe('getAggregates', () => {
    it('should compute aggregates for patterns in the window', () => {
      const now = new Date();
      storage.savePattern(makePattern({
        method: 'GET',
        path: '/api/users',
        durationMs: 100,
        statusCode: 200,
        timestamp: now,
      }));
      storage.savePattern(makePattern({
        method: 'GET',
        path: '/api/users',
        durationMs: 200,
        statusCode: 500,
        timestamp: now,
      }));
      storage.savePattern(makePattern({
        method: 'GET',
        path: '/api/users',
        durationMs: 300,
        statusCode: 200,
        timestamp: now,
      }));

      const result = storage.getAggregates(60);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(1);
        const agg = result.value[0];
        expect(agg.method).toBe('GET');
        expect(agg.path).toBe('/api/users');
        expect(agg.count).toBe(3);
        expect(agg.avgDurationMs).toBe(200);
        expect(agg.errorCount).toBe(1);
        expect(agg.errorRate).toBeCloseTo(1 / 3, 5);
      }
    });

    it('should return empty array when no patterns in window', () => {
      const result = storage.getAggregates(1);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual([]);
      }
    });

    it('should group aggregates by method:path', () => {
      const now = new Date();
      storage.savePattern(makePattern({ method: 'GET', path: '/api/users', timestamp: now }));
      storage.savePattern(makePattern({ method: 'POST', path: '/api/users', timestamp: now }));
      storage.savePattern(makePattern({ method: 'GET', path: '/api/other', timestamp: now }));

      const result = storage.getAggregates(60);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(3);
      }
    });
  });

  // ---- saveAnomaly / getRecentAnomalies ----

  describe('saveAnomaly and getRecentAnomalies', () => {
    it('should save and retrieve recent anomalies in reverse order', () => {
      storage.saveAnomaly(makeAnomaly({ id: 'a1', detectedAt: new Date('2025-01-01') }));
      storage.saveAnomaly(makeAnomaly({ id: 'a2', detectedAt: new Date('2025-06-01') }));
      storage.saveAnomaly(makeAnomaly({ id: 'a3', detectedAt: new Date('2025-12-01') }));

      const result = storage.getRecentAnomalies(2);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(2);
        expect(result.value[0].id).toBe('a3');
        expect(result.value[1].id).toBe('a2');
      }
    });

    it('should return all anomalies when limit exceeds count', () => {
      storage.saveAnomaly(makeAnomaly({ id: 'a1' }));
      storage.saveAnomaly(makeAnomaly({ id: 'a2' }));

      const result = storage.getRecentAnomalies(10);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(2);
      }
    });

    it('should return empty array when no anomalies exist', () => {
      const result = storage.getRecentAnomalies(5);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual([]);
      }
    });
  });

  // ---- saveConfig / loadConfig ----

  describe('saveConfig and loadConfig', () => {
    it('should save and load config', () => {
      const config: TunableConfig = {
        circuitBreaker: { failureThreshold: 30, openTimeoutMs: 15000 },
        bulkhead: { maxConcurrentCalls: 5 },
        httpClient: { timeoutMs: 5000, maxRetries: 2 },
      };

      const saveResult = storage.saveConfig(config);
      expect(saveResult.ok).toBe(true);

      const loadResult = storage.loadConfig();
      expect(loadResult.ok).toBe(true);
      if (loadResult.ok && loadResult.value) {
        expect(loadResult.value).toEqual(config);
      }
    });

    it('should return default config on first load', () => {
      const result = storage.loadConfig();

      expect(result.ok).toBe(true);
      if (result.ok && result.value) {
        expect(result.value.httpClient.timeoutMs).toBe(10000);
        expect(result.value.httpClient.maxRetries).toBe(3);
      }
    });

    it('should overwrite previous config on save', () => {
      storage.saveConfig({
        circuitBreaker: { failureThreshold: 10, openTimeoutMs: 5000 },
        bulkhead: { maxConcurrentCalls: 2 },
        httpClient: { timeoutMs: 1000, maxRetries: 1 },
      });

      const result = storage.loadConfig();
      expect(result.ok).toBe(true);
      if (result.ok && result.value) {
        expect(result.value.httpClient.timeoutMs).toBe(1000);
        expect(result.value.httpClient.maxRetries).toBe(1);
      }
    });
  });

  // ---- saveCycleEvent / getLastCycleTime ----

  describe('saveCycleEvent and getLastCycleTime', () => {
    it('should save cycle events and return last cycle time', () => {
      const t1 = new Date('2025-01-01');
      const t2 = new Date('2025-06-01');

      storage.saveCycleEvent(makeCycleEvent({ cycleId: 'c1', timestamp: t1 }));
      storage.saveCycleEvent(makeCycleEvent({ cycleId: 'c2', timestamp: t2 }));

      const result = storage.getLastCycleTime();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual(t2);
      }
    });

    it('should return null when no cycles exist', () => {
      const result = storage.getLastCycleTime();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBeNull();
      }
    });
  });

  // ---- prune ----

  describe('prune', () => {
    it('should remove patterns and anomalies before the given date', () => {
      const now = new Date();
      const old = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      storage.savePattern(makePattern({ timestamp: old }));
      storage.savePattern(makePattern({ timestamp: now }));
      storage.saveAnomaly(makeAnomaly({ detectedAt: old }));
      storage.saveAnomaly(makeAnomaly({ detectedAt: now }));

      const cutoff = new Date(now.getTime() - 60_000);
      const result = storage.prune(cutoff);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(2); // 1 old pattern + 1 old anomaly
      }

      // Verify remaining
      const patternsResult = storage.getPatterns(new Date(0), new Date());
      expect(patternsResult.ok).toBe(true);
      if (patternsResult.ok) {
        expect(patternsResult.value).toHaveLength(1);
      }
    });

    it('should return 0 when nothing to prune', () => {
      const now = new Date();
      storage.savePattern(makePattern({ timestamp: now }));

      const result = storage.prune(new Date(now.getTime() - 60_000));

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(0);
      }
    });

    it('should handle empty storage', () => {
      const result = storage.prune(new Date());

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(0);
      }
    });
  });
});
