import { ok, fail } from '@backendkit-labs/result';
import type { Result } from '@backendkit-labs/result';
import { StorageAdapter } from './storage-adapter.js';
import {
  EndpointPattern,
  AggregatePattern,
  AnomalyReport,
  LearningCycleEvent,
  TunableConfig,
} from '../types.js';
import { LearningError, storageError } from '../errors.js';

const DEFAULT_CONFIG: TunableConfig = {
  timeoutMs: 10000,
  maxRetries: 3,
  circuitBreakerThreshold: 0.5,
  circuitBreakerHalfOpenAfterMs: 30000,
  bulkheadMaxConcurrent: 10,
};

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

export class InMemoryStorage implements StorageAdapter {
  private patterns: EndpointPattern[] = [];
  private anomalies: AnomalyReport[] = [];
  private config: TunableConfig = { ...DEFAULT_CONFIG };
  private cycles: LearningCycleEvent[] = [];

  savePattern(pattern: EndpointPattern): Result<void, LearningError> {
    try {
      this.patterns.push(pattern);
      return ok(undefined);
    } catch (e) {
      return fail(storageError('Failed to save pattern', e));
    }
  }

  getPatterns(windowStart: Date, windowEnd: Date): Result<EndpointPattern[], LearningError> {
    try {
      return ok(
        this.patterns.filter(
          (p) => p.timestamp >= windowStart && p.timestamp <= windowEnd,
        ),
      );
    } catch (e) {
      return fail(storageError('Failed to get patterns', e));
    }
  }

  getAggregates(windowMinutes: number): Result<AggregatePattern[], LearningError> {
    try {
      const cutoff = new Date(Date.now() - windowMinutes * 60_000);
      const recent = this.patterns.filter((p) => p.timestamp >= cutoff);

      const groups = new Map<string, EndpointPattern[]>();
      for (const p of recent) {
        const key = `${p.method}:${p.path}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(p);
      }

      const aggregates: AggregatePattern[] = [];
      for (const [key, items] of groups) {
        const [method, path] = key.split(':');
        const durations = items.map((i) => i.durationMs).sort((a, b) => a - b);
        const errors = items.filter((i) => i.statusCode >= 500).length;

        aggregates.push({
          method,
          path,
          windowStart: cutoff,
          windowEnd: new Date(),
          count: items.length,
          avgDurationMs:
            durations.reduce((a, b) => a + b, 0) / durations.length,
          p50Ms: percentile(durations, 50),
          p95Ms: percentile(durations, 95),
          p99Ms: percentile(durations, 99),
          errorCount: errors,
          errorRate: errors / items.length,
        });
      }

      return ok(aggregates);
    } catch (e) {
      return fail(storageError('Failed to get aggregates', e));
    }
  }

  saveAnomaly(report: AnomalyReport): Result<void, LearningError> {
    try {
      this.anomalies.push(report);
      return ok(undefined);
    } catch (e) {
      return fail(storageError('Failed to save anomaly', e));
    }
  }

  getRecentAnomalies(limit: number): Result<AnomalyReport[], LearningError> {
    try {
      return ok(this.anomalies.slice(-limit).reverse());
    } catch (e) {
      return fail(storageError('Failed to get recent anomalies', e));
    }
  }

  saveConfig(config: TunableConfig): Result<void, LearningError> {
    try {
      this.config = { ...config };
      return ok(undefined);
    } catch (e) {
      return fail(storageError('Failed to save config', e));
    }
  }

  loadConfig(): Result<TunableConfig | null, LearningError> {
    try {
      return ok(this.config);
    } catch (e) {
      return fail(storageError('Failed to load config', e));
    }
  }

  saveCycleEvent(event: LearningCycleEvent): Result<void, LearningError> {
    try {
      this.cycles.push(event);
      return ok(undefined);
    } catch (e) {
      return fail(storageError('Failed to save cycle event', e));
    }
  }

  getLastCycleTime(): Result<Date | null, LearningError> {
    try {
      if (this.cycles.length === 0) return ok(null);
      return ok(this.cycles[this.cycles.length - 1].timestamp);
    } catch (e) {
      return fail(storageError('Failed to get last cycle time', e));
    }
  }

  prune(before: Date): Result<number, LearningError> {
    try {
      const beforeLen = this.patterns.length + this.anomalies.length;
      this.patterns = this.patterns.filter((p) => p.timestamp >= before);
      this.anomalies = this.anomalies.filter((a) => a.detectedAt >= before);
      const pruned = beforeLen - (this.patterns.length + this.anomalies.length);
      return ok(pruned);
    } catch (e) {
      return fail(storageError('Failed to prune', e));
    }
  }
}
