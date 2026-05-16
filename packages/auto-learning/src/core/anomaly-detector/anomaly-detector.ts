import { ok, fail } from '@backendkit-labs/result';
import type { Result } from '@backendkit-labs/result';
import { v4 as uuid } from 'uuid';
import { IAnomalyDetector, AnomalyReport, AnomalyDetectorConfig, DEFAULT_ANOMALY_CONFIG } from './types.js';
import { EndpointPattern, AggregatePattern } from '../types.js';
import { LearningError, anomalyDetectionFailed } from '../errors.js';

export class AnomalyDetector implements IAnomalyDetector {
  private readonly config: AnomalyDetectorConfig;

  constructor(config?: Partial<AnomalyDetectorConfig>) {
    this.config = { ...DEFAULT_ANOMALY_CONFIG, ...config };
  }

  analyze(
    current: EndpointPattern,
    baseline: AggregatePattern,
  ): Result<AnomalyReport[], LearningError> {
    try {
      const reports: AnomalyReport[] = [];

      // Latency anomaly: check if duration deviates from baseline
      if (baseline.count > 0) {
        const latencyDeviation =
          Math.abs(current.durationMs - baseline.avgDurationMs) /
          Math.max(this.stdDev(baseline), 1);

        if (latencyDeviation > this.config.latencyStdDevThreshold) {
          reports.push({
            id: uuid(),
            endpoint: current.path,
            method: current.method,
            severity: this.calculateSeverity(latencyDeviation),
            metric: 'latency',
            expectedValue: baseline.avgDurationMs,
            actualValue: current.durationMs,
            deviation: latencyDeviation,
            detectedAt: new Date(),
          });
        }
      }

      // Error rate anomaly: alert when a 5xx arrives at an endpoint that is
      // normally healthy (baseline errorRate below threshold). Avoids noise
      // from already-degraded endpoints.
      if (current.statusCode >= 500 && baseline.errorRate < this.config.errorRateThreshold) {
        reports.push({
          id: uuid(),
          endpoint: current.path,
          method: current.method,
          severity: 'high',
          metric: 'error_rate',
          expectedValue: baseline.errorRate,
          actualValue: 1,
          deviation: 1 / Math.max(baseline.errorRate, 0.001),
          detectedAt: new Date(),
        });
      }

      return ok(reports);
    } catch (e) {
      return fail(
        anomalyDetectionFailed(
          e instanceof Error ? e.message : 'Unknown anomaly detection error',
        ),
      );
    }
  }

  batchAnalyze(
    windowPatterns: EndpointPattern[],
    baselines: AggregatePattern[],
  ): Result<AnomalyReport[], LearningError> {
    try {
      const baselineMap = new Map<string, AggregatePattern>();
      for (const b of baselines) {
        baselineMap.set(`${b.method}:${b.path}`, b);
      }

      const reports: AnomalyReport[] = [];
      const seenUnknown = new Set<string>();

      for (const pattern of windowPatterns) {
        const key = `${pattern.method}:${pattern.path}`;
        const baseline = baselineMap.get(key);

        if (!baseline) {
          if (this.config.enableUnknownEndpointDetection && !seenUnknown.has(key)) {
            seenUnknown.add(key);
            reports.push({
              id: uuid(),
              endpoint: pattern.path,
              method: pattern.method,
              severity: 'low',
              metric: 'unknown_endpoint',
              expectedValue: 0,
              actualValue: 1,
              deviation: 1,
              detectedAt: new Date(),
            });
          }
          continue;
        }

        const result = this.analyze(pattern, baseline);
        if (result.ok) {
          reports.push(...result.value);
        }
      }

      return ok(reports);
    } catch (e) {
      return fail(
        anomalyDetectionFailed(
          e instanceof Error ? e.message : 'Unknown batch analysis error',
        ),
      );
    }
  }

  private calculateSeverity(deviation: number): 'low' | 'medium' | 'high' | 'critical' {
    if (deviation > 5) return 'critical';
    if (deviation > 4) return 'high';
    if (deviation > 3) return 'medium';
    return 'low';
  }

  private stdDev(baseline: AggregatePattern): number {
    return (baseline.p95Ms - baseline.p50Ms) / 2;
  }
}
