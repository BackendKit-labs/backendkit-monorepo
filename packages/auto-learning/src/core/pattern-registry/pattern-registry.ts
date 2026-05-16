import { ok, fail } from '@backendkit-labs/result';
import type { Result } from '@backendkit-labs/result';
import { IPatternRegistry, RegistryStats } from './types.js';
import { EndpointPattern, AggregatePattern } from '../types.js';
import { LearningError, storageError } from '../errors.js';
import { StorageAdapter } from '../persistence/storage-adapter.js';
import { ObservabilityAdapter } from '../observability/observability-adapter.js';

export class PatternRegistry implements IPatternRegistry {
  constructor(
    private readonly storage: StorageAdapter,
    private readonly observability: ObservabilityAdapter,
  ) {}

  record(pattern: EndpointPattern): Result<void, LearningError> {
    const result = this.storage.savePattern(pattern);
    if (!result.ok) {
      this.observability.error('Failed to record pattern', {
        error: result.error,
        pattern: { method: pattern.method, path: pattern.path },
      });
      return fail(storageError('Failed to save pattern', result.error));
    }

    this.observability.incrementMetric('patterns.recorded', 1, {
      method: pattern.method,
      path: pattern.path,
    });

    this.observability.histogramMetric('patterns.duration_ms', pattern.durationMs, {
      method: pattern.method,
      path: pattern.path,
    });

    return ok(undefined);
  }

  getAggregates(windowMinutes: number): Result<AggregatePattern[], LearningError> {
    const result = this.storage.getAggregates(windowMinutes);
    if (!result.ok) {
      this.observability.error('Failed to get aggregates', { error: result.error });
      return fail(storageError('Failed to get aggregates', result.error));
    }
    return ok(result.value);
  }

  getHistory(
    endpoint: string,
    method: string,
    limit: number,
  ): Result<EndpointPattern[], LearningError> {
    const now = new Date();
    const past = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const patterns = this.storage.getPatterns(past, now);

    if (!patterns.ok) {
      return fail(storageError('Failed to get history', patterns.error));
    }

    const filtered = patterns.value
      .filter((p: EndpointPattern) => p.path === endpoint && p.method === method)
      .slice(-limit);

    return ok(filtered);
  }

  getStats(): Result<RegistryStats, LearningError> {
    const now = new Date();
    const past = new Date(0);
    const patterns = this.storage.getPatterns(past, now);

    if (!patterns.ok) {
      return fail(storageError('Failed to get stats', patterns.error));
    }

    const all = patterns.value;
    if (all.length === 0) {
      return ok({
        totalPatterns: 0,
        uniqueEndpoints: 0,
        oldestPattern: now,
        newestPattern: now,
      });
    }

    const uniqueEndpoints = new Set(all.map((p: EndpointPattern) => `${p.method}:${p.path}`));
    const timestamps = all.map((p: EndpointPattern) => p.timestamp.getTime());

    return ok({
      totalPatterns: all.length,
      uniqueEndpoints: uniqueEndpoints.size,
      oldestPattern: new Date(Math.min(...timestamps)),
      newestPattern: new Date(Math.max(...timestamps)),
    });
  }
}
