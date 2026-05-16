import type { Result } from '@backendkit-labs/result';
import { EndpointPattern, AggregatePattern, AnomalySeverity } from '../types.js';
import { LearningError } from '../errors.js';

export interface IAnomalyDetector {
  analyze(
    current: EndpointPattern,
    baseline: AggregatePattern,
  ): Result<AnomalyReport | null, LearningError>;

  batchAnalyze(
    windowPatterns: EndpointPattern[],
    baselines: AggregatePattern[],
  ): Result<AnomalyReport[], LearningError>;
}

export type AnomalyReport = {
  id: string;
  endpoint: string;
  method: string;
  severity: AnomalySeverity;
  metric: 'latency' | 'error_rate' | 'frequency' | 'unknown_endpoint';
  expectedValue: number;
  actualValue: number;
  deviation: number;
  detectedAt: Date;
};

export type AnomalyDetectorConfig = {
  latencyStdDevThreshold: number;
  errorRateThreshold: number;
  frequencyDeviationThreshold: number;
  enableUnknownEndpointDetection: boolean;
};

export const DEFAULT_ANOMALY_CONFIG: AnomalyDetectorConfig = {
  latencyStdDevThreshold: 2.5,
  errorRateThreshold: 0.05,
  frequencyDeviationThreshold: 3.0,
  enableUnknownEndpointDetection: true,
};
