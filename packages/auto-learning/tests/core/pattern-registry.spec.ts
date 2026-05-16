import { vi } from 'vitest';
import { ok, fail } from '@backendkit-labs/result';
import { PatternRegistry } from '../../src/core/pattern-registry/pattern-registry.js';
import { StorageAdapter } from '../../src/core/persistence/storage-adapter.js';
import { ObservabilityAdapter } from '../../src/core/observability/observability-adapter.js';
import { EndpointPattern, AggregatePattern } from '../../src/core/types.js';
import { LearningError, storageError } from '../../src/core/errors.js';

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

const makeStorageMock = (): vi.Mocked<StorageAdapter> => ({
  savePattern: vi.fn(),
  getPatterns: vi.fn(),
  getAggregates: vi.fn(),
  saveAnomaly: vi.fn(),
  getRecentAnomalies: vi.fn(),
  saveConfig: vi.fn(),
  loadConfig: vi.fn(),
  saveCycleEvent: vi.fn(),
  getLastCycleTime: vi.fn(),
  prune: vi.fn(),
});

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

describe('PatternRegistry', () => {
  let storage: vi.Mocked<StorageAdapter>;
  let observability: vi.Mocked<ObservabilityAdapter>;
  let registry: PatternRegistry;

  beforeEach(() => {
    storage = makeStorageMock();
    observability = makeObservabilityMock();
    registry = new PatternRegistry(storage, observability);
  });

  // ---- record ----

  describe('record', () => {
    it('should save a pattern and emit metrics on success', () => {
      storage.savePattern.mockReturnValue(ok(undefined));

      const pattern = makePattern();
      const result = registry.record(pattern);

      expect(result.ok).toBe(true);
      expect(storage.savePattern).toHaveBeenCalledWith(pattern);
      expect(observability.incrementMetric).toHaveBeenCalledWith(
        'patterns.recorded',
        1,
        { method: 'GET', path: '/api/users' },
      );
      expect(observability.histogramMetric).toHaveBeenCalledWith(
        'patterns.duration_ms',
        100,
        { method: 'GET', path: '/api/users' },
      );
    });

    it('should return fail when storage.savePattern fails', () => {
      const err = storageError('DB down');
      storage.savePattern.mockReturnValue(fail(err));

      const pattern = makePattern();
      const result = registry.record(pattern);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.tag).toBe('STORAGE_ERROR');
        expect(result.error.message).toBe('Failed to save pattern');
      }
      expect(observability.error).toHaveBeenCalled();
    });

    it('should not emit metrics when save fails', () => {
      storage.savePattern.mockReturnValue(fail(storageError('fail')));

      registry.record(makePattern());

      expect(observability.incrementMetric).not.toHaveBeenCalled();
      expect(observability.histogramMetric).not.toHaveBeenCalled();
    });
  });

  // ---- getAggregates ----

  describe('getAggregates', () => {
    it('should return aggregates from storage', () => {
      const aggregates: AggregatePattern[] = [
        {
          method: 'GET',
          path: '/api/users',
          windowStart: new Date(),
          windowEnd: new Date(),
          count: 10,
          avgDurationMs: 100,
          p50Ms: 90,
          p95Ms: 200,
          p99Ms: 300,
          errorCount: 1,
          errorRate: 0.1,
        },
      ];
      storage.getAggregates.mockReturnValue(ok(aggregates));

      const result = registry.getAggregates(5);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual(aggregates);
      }
      expect(storage.getAggregates).toHaveBeenCalledWith(5);
    });

    it('should return fail when storage.getAggregates fails', () => {
      storage.getAggregates.mockReturnValue(fail(storageError('fail')));

      const result = registry.getAggregates(5);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.tag).toBe('STORAGE_ERROR');
      }
      expect(observability.error).toHaveBeenCalled();
    });
  });

  // ---- getHistory ----

  describe('getHistory', () => {
    const now = new Date();

    it('should filter and return matching patterns within 24h', () => {
      const matching: EndpointPattern[] = [
        makePattern({ path: '/api/users', method: 'GET', timestamp: new Date(now.getTime() - 60_000) }),
        makePattern({ path: '/api/users', method: 'GET', timestamp: new Date(now.getTime() - 120_000) }),
      ];
      const nonMatching: EndpointPattern[] = [
        makePattern({ path: '/api/other', method: 'GET', timestamp: now }),
        makePattern({ path: '/api/users', method: 'POST', timestamp: now }),
      ];
      storage.getPatterns.mockReturnValue(ok([...matching, ...nonMatching]));

      const result = registry.getHistory('/api/users', 'GET', 10);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(2);
        expect(result.value.every((p) => p.path === '/api/users' && p.method === 'GET')).toBe(true);
      }
    });

    it('should respect the limit parameter', () => {
      const patterns = Array.from({ length: 20 }, (_, i) =>
        makePattern({ path: '/api/users', method: 'GET', timestamp: new Date(now.getTime() - i * 60_000) }),
      );
      storage.getPatterns.mockReturnValue(ok(patterns));

      const result = registry.getHistory('/api/users', 'GET', 5);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(5);
      }
    });

    it('should return empty array when no patterns match', () => {
      storage.getPatterns.mockReturnValue(ok([]));

      const result = registry.getHistory('/api/users', 'GET', 10);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual([]);
      }
    });

    it('should return fail when storage.getPatterns fails', () => {
      storage.getPatterns.mockReturnValue(fail(storageError('fail')));

      const result = registry.getHistory('/api/users', 'GET', 10);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.tag).toBe('STORAGE_ERROR');
      }
    });
  });

  // ---- getStats ----

  describe('getStats', () => {
    it('should compute stats from all stored patterns', () => {
      const patterns = [
        makePattern({ path: '/api/users', method: 'GET', timestamp: new Date('2025-01-01') }),
        makePattern({ path: '/api/users', method: 'GET', timestamp: new Date('2025-06-01') }),
        makePattern({ path: '/api/other', method: 'POST', timestamp: new Date('2025-03-01') }),
      ];
      storage.getPatterns.mockReturnValue(ok(patterns));

      const result = registry.getStats();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.totalPatterns).toBe(3);
        expect(result.value.uniqueEndpoints).toBe(2);
        expect(result.value.oldestPattern).toEqual(new Date('2025-01-01'));
        expect(result.value.newestPattern).toEqual(new Date('2025-06-01'));
      }
    });

    it('should return zero stats when no patterns exist', () => {
      storage.getPatterns.mockReturnValue(ok([]));

      const result = registry.getStats();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.totalPatterns).toBe(0);
        expect(result.value.uniqueEndpoints).toBe(0);
      }
    });

    it('should return fail when storage.getPatterns fails', () => {
      storage.getPatterns.mockReturnValue(fail(storageError('fail')));

      const result = registry.getStats();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.tag).toBe('STORAGE_ERROR');
      }
    });

    it('should not throw RangeError with very large pattern arrays (was: Math.min/max spread)', () => {
      const t0 = new Date('2024-01-01').getTime();
      const patterns = Array.from({ length: 50_000 }, (_, i) =>
        makePattern({ timestamp: new Date(t0 + i * 1000) }),
      );
      storage.getPatterns.mockReturnValue(ok(patterns));

      expect(() => registry.getStats()).not.toThrow();

      const result = registry.getStats();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.totalPatterns).toBe(50_000);
        expect(result.value.oldestPattern).toEqual(new Date(t0));
        expect(result.value.newestPattern).toEqual(new Date(t0 + 49_999 * 1000));
      }
    });
  });
});
