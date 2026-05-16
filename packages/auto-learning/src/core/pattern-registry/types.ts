import type { Result } from '@backendkit-labs/result';
import { EndpointPattern, AggregatePattern } from '../types.js';
import { LearningError } from '../errors.js';

export interface IPatternRegistry {
  record(pattern: EndpointPattern): Result<void, LearningError>;
  getAggregates(windowMinutes: number, windowEnd?: Date): Result<AggregatePattern[], LearningError>;
  getHistory(
    endpoint: string,
    method: string,
    limit: number,
  ): Result<EndpointPattern[], LearningError>;
  getStats(): Result<RegistryStats, LearningError>;
}

export type RegistryStats = {
  totalPatterns: number;
  uniqueEndpoints: number;
  oldestPattern: Date;
  newestPattern: Date;
};
