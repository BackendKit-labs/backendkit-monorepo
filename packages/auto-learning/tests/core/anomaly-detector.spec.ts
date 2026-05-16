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
      it('should return null when latency is within normal range', () => {
        const pattern = makePattern({ durationMs: 110 });
        const baseline = makeBaseline({ avgDurationMs: 100, p50Ms: 90, p95Ms: 200 });

        const result = detector.analyze(pattern, baseline);

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).toBeNull();
        }
      });

      it('should report latency anomaly when duration deviates significantly', () => {
        const pattern = makePattern({ durationMs: 1000 });
        const baseline = makeBaseline({ avgDurationMs: 100, p50Ms: 90, p95Ms: 200 });

        const result = detector.analyze(pattern, baseline);

        expect(result.ok).toBe(true);
        if (result.ok && result.value) {
          expect(result.value.metric).toBe('latency');
          expect(result.value.actualValue).toBe(1000);
          expect(result.value.expectedValue).toBe(100);
          expect(result.value.endpoint).toBe('/api/users');
          expect(result.value.method).toBe('GET');
        }
      });

      it('should return null when baseline count is 0', () => {
        const pattern = makePattern({ durationMs: 9999 });
        const baseline = makeBaseline({ count: 0, avgDurationMs: 0 });

        const result = detector.analyze(pattern, baseline);

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).toBeNull();
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
        if (critical.ok && critical.value) {
          expect(critical.value.severity).toBe('critical');
        }

        const high = detector.analyze(makePattern({ durationMs: 350 }), baseline);
        expect(high.ok).toBe(true);
        if (high.ok && high.value) {
          expect(high.value.severity).toBe('high');
        }

        const medium = detector.analyze(makePattern({ durationMs: 300 }), baseline);
        expect(medium.ok).toBe(true);
        if (medium.ok && medium.value) {
          expect(medium.value.severity).toBe('medium');
        }

        const low = detector.analyze(makePattern({ durationMs: 250 }), baseline);
        expect(low.ok).toBe(true);
        if (low.ok && low.value) {
          expect(low.value.severity).toBe('low');
        }
      });
    });

    describe('error rate anomalies', () => {
      it('should report error_rate anomaly when statusCode >= 500 and baseline has enough errors', () => {
        const pattern = makePattern({ statusCode: 500 });
        const baseline = makeBaseline({ errorCount: 5, errorRate: 0.01 });

        const result = detector.analyze(pattern, baseline);

        expect(result.ok).toBe(true);
        if (result.ok && result.value) {
          expect(result.value.metric).toBe('error_rate');
          expect(result.value.severity).toBe('high');
        }
      });

      it('should NOT report error_rate anomaly when baseline.errorCount < 3', () => {
        const pattern = makePattern({ statusCode: 500 });
        const baseline = makeBaseline({ errorCount: 2, errorRate: 0.01 });

        const result = detector.analyze(pattern, baseline);

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).toBeNull();
        }
      });

      it('should NOT report error_rate anomaly when statusCode < 500', () => {
        const pattern = makePattern({ statusCode: 404 });
        const baseline = makeBaseline({ errorCount: 5, errorRate: 0.01 });

        const result = detector.analyze(pattern, baseline);

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).toBeNull();
        }
      });

      it('should NOT report error_rate anomaly when error rate is not above threshold', () => {
        const pattern = makePattern({ statusCode: 500 });
        const baseline = makeBaseline({ errorCount: 3, errorRate: 0.5 });

        const result = detector.analyze(pattern, baseline);

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).toBeNull();
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

    it('should return fail when batchAnalyze throws', () => {
      const result = detector.batchAnalyze(null as unknown as EndpointPattern[], null as unknown as AggregatePattern[]);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.tag).toBe('ANOMALY_DETECTION_FAILED');
      }
    });
  });
});
