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
  circuitBreaker: { failureThreshold: 50, openTimeoutMs: 30000 },
  bulkhead: { maxConcurrentCalls: 10 },
  httpClient: { timeoutMs: 10000, maxRetries: 3 },
};

export type InMemoryStorageLimits = {
  /** Max patterns kept in memory. Oldest dropped when exceeded (FIFO). Default: 10_000 */
  maxPatterns: number;
  /** Max anomaly reports kept. Oldest dropped when exceeded. Default: 1_000 */
  maxAnomalies: number;
  /** Max cycle events kept. Oldest dropped when exceeded. Default: 1_000 */
  maxCycles: number;
};

const DEFAULT_LIMITS: InMemoryStorageLimits = {
  maxPatterns: 10_000,
  maxAnomalies: 1_000,
  maxCycles: 1_000,
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
  private readonly limits: InMemoryStorageLimits;

  constructor(limits?: Partial<InMemoryStorageLimits>) {
    this.limits = { ...DEFAULT_LIMITS, ...limits };
  }

  savePattern(pattern: EndpointPattern): Result<void, LearningError> {
    try {
      this.patterns.push(pattern);
      if (this.patterns.length > this.limits.maxPatterns) {
        this.patterns.shift();
      }
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

      // Use \x00 as separator so parameterized paths like /users/:id are preserved.
      type GroupEntry = { method: string; path: string; items: EndpointPattern[] };
      const groups = new Map<string, GroupEntry>();
      for (const p of recent) {
        const key = `${p.method}\x00${p.path}`;
        let g = groups.get(key);
        if (!g) { g = { method: p.method, path: p.path, items: [] }; groups.set(key, g); }
        g.items.push(p);
      }

      const aggregates: AggregatePattern[] = [];
      for (const { method, path, items } of groups.values()) {
        const durations = items.map((i) => i.durationMs).sort((a, b) => a - b);
        const errors = items.filter((i) => i.statusCode >= 500).length;

        aggregates.push({
          method,
          path,
          windowStart: cutoff,
          windowEnd: new Date(),
          count: items.length,
          avgDurationMs: durations.reduce((a, b) => a + b, 0) / durations.length,
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
      if (this.anomalies.length > this.limits.maxAnomalies) {
        this.anomalies.shift();
      }
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
      this.config = {
        circuitBreaker: { ...config.circuitBreaker },
        bulkhead: { ...config.bulkhead },
        httpClient: { ...config.httpClient },
      };
      return ok(undefined);
    } catch (e) {
      return fail(storageError('Failed to save config', e));
    }
  }

  loadConfig(): Result<TunableConfig | null, LearningError> {
    try {
      return ok({
        circuitBreaker: { ...this.config.circuitBreaker },
        bulkhead: { ...this.config.bulkhead },
        httpClient: { ...this.config.httpClient },
      });
    } catch (e) {
      return fail(storageError('Failed to load config', e));
    }
  }

  saveCycleEvent(event: LearningCycleEvent): Result<void, LearningError> {
    try {
      this.cycles.push(event);
      if (this.cycles.length > this.limits.maxCycles) {
        this.cycles.shift();
      }
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
