import type { Result } from '@backendkit-labs/result';
import { TunableConfig, AggregatePattern, AnomalyReport } from '../types.js';
import { LearningError } from '../errors.js';

export interface IConfigTuner {
  getCurrentConfig(): TunableConfig;
  tune(
    aggregates: AggregatePattern[],
    anomalies: AnomalyReport[],
  ): Result<TunableConfig, LearningError>;
  reset(): Result<TunableConfig, LearningError>;
  onConfigChange(callback: (config: TunableConfig) => void): () => void;
}

export type ConfigTunerConfig = {
  minTimeoutMs: number;
  maxTimeoutMs: number;
  smoothingFactor: number;
  adjustmentStepMs: number;
  /** Minimum milliseconds between successive config applications. Default: 60_000 */
  cooldownMs: number;
};

export const DEFAULT_TUNER_CONFIG: ConfigTunerConfig = {
  minTimeoutMs: 1000,
  maxTimeoutMs: 30000,
  smoothingFactor: 0.3,
  adjustmentStepMs: 500,
  cooldownMs: 60_000,
};
