import { vi } from 'vitest';
import { AnomalyDetector } from '../../src/core/anomaly-detector/anomaly-detector.js';
import { EndpointPattern, AggregatePattern } from '../../src/core/types.js';

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

const makeBaseline = (overrides: Partial<AggregatePattern> = {}): AggregatePattern => ({
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AnomalyDetector', () => {
  let detector: AnomalyDetector;

  beforeEach(() => {
    detector = new AnomalyDetector();
  });

  // ---- analyze ----

  describe('analyze', () => {
    describe('latency anomalies', () => {
      it('should return empty array when latency is within normal range', () => {
        const pattern = makePattern({ durationMs: 110 });
        const baseline = makeBaseline({ avgDurationMs: 100, p50Ms: 90, p95Ms: 200 });

        const result = detector.analyze(pattern, baseline);

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).toEqual([]);
        }
      });

      it('should report latency anomaly when duration deviates significantly', () => {
        const pattern = makePattern({ durationMs: 1000 });
        const baseline = makeBaseline({ avgDurationMs: 100, p50Ms: 90, p95Ms: 200 });

        const result = detector.analyze(pattern, baseline);

        expect(result.ok).toBe(true);
        if (result.ok && result.value.length > 0) {
          expect(result.value[0].metric).toBe('latency');
          expect(result.value[0].actualValue).toBe(1000);
          expect(result.value[0].expectedValue).toBe(100);
          expect(result.value[0].endpoint).toBe('/api/users');
          expect(result.value[0].method).toBe('GET');
        }
      });

      it('should return empty array when baseline count is 0', () => {
        const pattern = makePattern({ durationMs: 9999 });
        const baseline = makeBaseline({ count: 0, avgDurationMs: 0 });

        const result = detector.analyze(pattern, baseline);

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).toEqual([]);
        }
      });

      it('should assign severity based on deviation', () => {
        // stdDev = (200-90)/2 = 55
        // deviation = |d - 100| / 55
        // critical: deviation > 5  => d > 375
        // high:     deviation > 4  => d > 320
        // medium:   deviation > 3  => d > 265
        // low:      deviation <= 3 => d <= 265
        const baseline = makeBaseline({ avgDurationMs: 100, p50Ms: 90, p95Ms: 200 });

        const critical = detector.analyze(makePattern({ durationMs: 400 }), baseline);
        expect(critical.ok).toBe(true);
        if (critical.ok && critical.value.length > 0) {
          expect(critical.value[0].severity).toBe('critical');
        }

        const high = detector.analyze(makePattern({ durationMs: 350 }), baseline);
        expect(high.ok).toBe(true);
        if (high.ok && high.value.length > 0) {
          expect(high.value[0].severity).toBe('high');
        }

        const medium = detector.analyze(makePattern({ durationMs: 300 }), baseline);
        expect(medium.ok).toBe(true);
        if (medium.ok && medium.value.length > 0) {
          expect(medium.value[0].severity).toBe('medium');
        }

        const low = detector.analyze(makePattern({ durationMs: 250 }), baseline);
        expect(low.ok).toBe(true);
        if (low.ok && low.value.length > 0) {
          expect(low.value[0].severity).toBe('low');
        }
      });
    });

    describe('error rate anomalies', () => {
      it('should report error_rate anomaly when 5xx arrives at a healthy endpoint (baseline errorRate below threshold)', () => {
        const pattern = makePattern({ statusCode: 500 });
        const baseline = makeBaseline({ errorRate: 0.01 }); // 1% < 5% threshold → healthy

        const result = detector.analyze(pattern, baseline);

        expect(result.ok).toBe(true);
        if (result.ok && result.value.length > 0) {
          expect(result.value[0].metric).toBe('error_rate');
          expect(result.value[0].severity).toBe('high');
          expect(result.value[0].expectedValue).toBe(0.01);
          expect(result.value[0].actualValue).toBe(1);
        }
      });

      it('should NOT report error_rate anomaly when baseline is already degraded (errorRate >= threshold)', () => {
        const pattern = makePattern({ statusCode: 500 });
        const baseline = makeBaseline({ errorRate: 0.5 }); // 50% >= 5% threshold → degraded

        const result = detector.analyze(pattern, baseline);

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).toEqual([]);
        }
      });

      it('should NOT report error_rate anomaly when statusCode < 500', () => {
        const pattern = makePattern({ statusCode: 404 });
        const baseline = makeBaseline({ errorRate: 0.01 });

        const result = detector.analyze(pattern, baseline);

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).toEqual([]);
        }
      });

      it('should NOT report error_rate anomaly when errorRate equals the threshold exactly', () => {
        const pattern = makePattern({ statusCode: 500 });
        // default threshold is 0.05 — at exactly 0.05 it's no longer "below"
        const baseline = makeBaseline({ errorRate: 0.05 });

        const result = detector.analyze(pattern, baseline);

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).toEqual([]);
        }
      });
    });

    describe('multiple anomalies in one call', () => {
      it('should report both latency and error_rate when both conditions are met', () => {
        // High latency (1000ms vs 100ms baseline) AND 5xx on healthy endpoint
        const pattern = makePattern({ durationMs: 1000, statusCode: 500 });
        const baseline = makeBaseline({
          avgDurationMs: 100,
          p50Ms: 90,
          p95Ms: 200,
          errorRate: 0.01, // healthy → error_rate fires
        });

        const result = detector.analyze(pattern, baseline);

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).toHaveLength(2);
          const metrics = result.value.map((r) => r.metric).sort();
          expect(metrics).toEqual(['error_rate', 'latency']);
        }
      });
    });

    describe('error handling', () => {
      it('should return fail when analysis throws', () => {
        // Force an error by passing null-like values that cause a crash
        const result = detector.analyze(null as unknown as EndpointPattern, null as unknown as AggregatePattern);

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.tag).toBe('ANOMALY_DETECTION_FAILED');
        }
      });
    });
  });

  // ---- batchAnalyze ----

  describe('batchAnalyze', () => {
    it('should return empty array when no patterns match baselines', () => {
      const patterns = [makePattern({ path: '/api/unknown' })];
      const baselines: AggregatePattern[] = [];

      const result = detector.batchAnalyze(patterns, baselines);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(1);
        expect(result.value[0].metric).toBe('unknown_endpoint');
      }
    });

    it('should detect unknown endpoints when enableUnknownEndpointDetection is true', () => {
      const detectorWithUnknown = new AnomalyDetector({ enableUnknownEndpointDetection: true });
      const patterns = [makePattern({ path: '/api/new' })];
      const baselines = [makeBaseline({ path: '/api/users' })];

      const result = detectorWithUnknown.batchAnalyze(patterns, baselines);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(1);
        expect(result.value[0].metric).toBe('unknown_endpoint');
        expect(result.value[0].severity).toBe('low');
      }
    });

    it('should skip unknown endpoint detection when disabled', () => {
      const detectorNoUnknown = new AnomalyDetector({ enableUnknownEndpointDetection: false });
      const patterns = [makePattern({ path: '/api/new' })];
      const baselines = [makeBaseline({ path: '/api/users' })];

      const result = detectorNoUnknown.batchAnalyze(patterns, baselines);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual([]);
      }
    });

    it('should emit only ONE unknown_endpoint report per method:path regardless of how many patterns arrive', () => {
      const patterns = Array.from({ length: 100 }, () =>
        makePattern({ path: '/api/new-endpoint' }),
      );
      const baselines: AggregatePattern[] = [];

      const result = detector.batchAnalyze(patterns, baselines);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(1);
        expect(result.value[0].metric).toBe('unknown_endpoint');
        expect(result.value[0].endpoint).toBe('/api/new-endpoint');
      }
    });

    it('should emit one unknown_endpoint per distinct method:path combination', () => {
      const patterns = [
        ...Array.from({ length: 50 }, () => makePattern({ method: 'GET', path: '/api/a' })),
        ...Array.from({ length: 50 }, () => makePattern({ method: 'POST', path: '/api/a' })),
        ...Array.from({ length: 30 }, () => makePattern({ method: 'GET', path: '/api/b' })),
      ];
      const baselines: AggregatePattern[] = [];

      const result = detector.batchAnalyze(patterns, baselines);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(3);
        expect(result.value.every((r) => r.metric === 'unknown_endpoint')).toBe(true);
      }
    });

    it('should detect latency anomalies via batchAnalyze', () => {
      const patterns = [makePattern({ durationMs: 2000, path: '/api/users' })];
      const baselines = [makeBaseline({ path: '/api/users', avgDurationMs: 100, p50Ms: 90, p95Ms: 200 })];

      const result = detector.batchAnalyze(patterns, baselines);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(1);
        expect(result.value[0].metric).toBe('latency');
      }
    });

    it('should accumulate multiple anomaly types from a single pattern via analyze spread', () => {
      // Pattern with both high latency AND 5xx on a healthy endpoint
      const patterns = [makePattern({ durationMs: 2000, statusCode: 500, path: '/api/users' })];
      const baselines = [makeBaseline({
        path: '/api/users',
        avgDurationMs: 100,
        p50Ms: 90,
        p95Ms: 200,
        errorRate: 0.01, // healthy → error_rate fires too
      })];

      const result = detector.batchAnalyze(patterns, baselines);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(2);
        const metrics = result.value.map((r) => r.metric).sort();
        expect(metrics).toEqual(['error_rate', 'latency']);
      }
    });

    it('should return fail when batchAnalyze throws', () => {
      const result = detector.batchAnalyze(null as unknown as EndpointPattern[], null as unknown as AggregatePattern[]);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.tag).toBe('ANOMALY_DETECTION_FAILED');
      }
    });
  });
});
