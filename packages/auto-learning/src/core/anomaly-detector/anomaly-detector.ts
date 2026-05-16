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
  ): Result<AnomalyReport | null, LearningError> {
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

      // Error rate anomaly: require at least 3 errors in the window
      // to avoid false positives from individual 500s
      if (current.statusCode >= 500 && baseline.errorCount >= 3) {
        const currentErrorRate = 1.0;
        if (currentErrorRate > baseline.errorRate * 2 && currentErrorRate > this.config.errorRateThreshold) {
          reports.push({
            id: uuid(),
            endpoint: current.path,
            method: current.method,
            severity: 'high',
            metric: 'error_rate',
            expectedValue: baseline.errorRate,
            actualValue: currentErrorRate,
            deviation: currentErrorRate / Math.max(baseline.errorRate, 0.001),
            detectedAt: new Date(),
          });
        }
      }

      return ok(reports.length > 0 ? reports[0] : null);
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

      for (const pattern of windowPatterns) {
        const key = `${pattern.method}:${pattern.path}`;
        const baseline = baselineMap.get(key);

        if (!baseline) {
          if (this.config.enableUnknownEndpointDetection) {
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
        if (result.ok && result.value) {
          reports.push(result.value);
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
