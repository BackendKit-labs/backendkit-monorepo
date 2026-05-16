import type { Result } from '@backendkit-labs/result';
import {
  EndpointPattern,
  AggregatePattern,
  AnomalyReport,
  LearningCycleEvent,
  TunableConfig,
} from '../types.js';
import { LearningError } from '../errors.js';

export interface StorageAdapter {
  savePattern(pattern: EndpointPattern): Result<void, LearningError>;
  getPatterns(windowStart: Date, windowEnd: Date): Result<EndpointPattern[], LearningError>;
  getAggregates(windowMinutes: number, windowEnd?: Date): Result<AggregatePattern[], LearningError>;

  saveAnomaly(report: AnomalyReport): Result<void, LearningError>;
  getRecentAnomalies(limit: number): Result<AnomalyReport[], LearningError>;

  saveConfig(config: TunableConfig): Result<void, LearningError>;
  loadConfig(): Result<TunableConfig | null, LearningError>;

  saveCycleEvent(event: LearningCycleEvent): Result<void, LearningError>;
  getLastCycleTime(): Result<Date | null, LearningError>;

  prune(before: Date): Result<number, LearningError>;
}
