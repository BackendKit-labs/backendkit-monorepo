import { ok, fail } from '@backendkit-labs/result';
import type { Result } from '@backendkit-labs/result';
import { IConfigTuner, ConfigTunerConfig, DEFAULT_TUNER_CONFIG } from './types.js';
import { TunableConfig, AggregatePattern, AnomalyReport } from '../types.js';
import { LearningError, storageError } from '../errors.js';
import { StorageAdapter } from '../persistence/storage-adapter.js';
import { ObservabilityAdapter } from '../observability/observability-adapter.js';

const DEFAULT_CONFIG: TunableConfig = {
  circuitBreaker: { failureThreshold: 50, openTimeoutMs: 30000 },
  bulkhead: { maxConcurrentCalls: 10 },
  httpClient: { timeoutMs: 10000, maxRetries: 3 },
};

export class ConfigTuner implements IConfigTuner {
  private currentConfig: TunableConfig;
  private readonly config: ConfigTunerConfig;
  private listeners: Array<(config: TunableConfig) => void> = [];
  private lastChangeAt: number = 0;

  constructor(
    private readonly storage: StorageAdapter,
    private readonly observability: ObservabilityAdapter,
    tunerConfig?: Partial<ConfigTunerConfig>,
  ) {
    this.config = { ...DEFAULT_TUNER_CONFIG, ...tunerConfig };

    const loaded = this.storage.loadConfig();
    this.currentConfig = loaded.ok && loaded.value
      ? loaded.value
      : { ...DEFAULT_CONFIG };
  }

  getCurrentConfig(): TunableConfig {
    return {
      circuitBreaker: { ...this.currentConfig.circuitBreaker },
      bulkhead: { ...this.currentConfig.bulkhead },
      httpClient: { ...this.currentConfig.httpClient },
    };
  }

  tune(
    aggregates: AggregatePattern[],
    anomalies: AnomalyReport[],
  ): Result<TunableConfig, LearningError> {
    if (aggregates.length === 0) {
      return ok(this.getCurrentConfig());
    }

    const newConfig = this.computeNext(aggregates, anomalies);
    const changedSections = this.diffSections(this.currentConfig, newConfig);

    if (changedSections.size > 0) {
      const now = Date.now();
      if (now - this.lastChangeAt > this.config.cooldownMs) {
        this.currentConfig = newConfig;
        this.lastChangeAt = now;

        const saveResult = this.storage.saveConfig(newConfig);
        if (!saveResult.ok) {
          return fail(storageError('Failed to save config', saveResult.error));
        }

        const changes = Object.fromEntries(
          [...changedSections].map((s) => [s, newConfig[s]]),
        );
        this.observability.info('Config tuned', { changes });
        this.observability.incrementMetric('config.changes', 1);

        for (const listener of this.listeners) {
          listener(this.getCurrentConfig());
        }
      }
    }

    return ok(this.getCurrentConfig());
  }

  reset(): Result<TunableConfig, LearningError> {
    this.currentConfig = {
      circuitBreaker: { ...DEFAULT_CONFIG.circuitBreaker },
      bulkhead: { ...DEFAULT_CONFIG.bulkhead },
      httpClient: { ...DEFAULT_CONFIG.httpClient },
    };
    const saveResult = this.storage.saveConfig(this.currentConfig);
    if (!saveResult.ok) {
      return fail(storageError('Failed to reset config', saveResult.error));
    }

    this.observability.info('Config reset to defaults');
    for (const listener of this.listeners) {
      listener(this.getCurrentConfig());
    }

    return ok(this.getCurrentConfig());
  }

  onConfigChange(callback: (config: TunableConfig) => void): () => void {
    this.listeners.push(callback);
    return () => {
      const idx = this.listeners.indexOf(callback);
      if (idx >= 0) this.listeners.splice(idx, 1);
    };
  }

  // Pure computation — derives the next config from aggregates and anomalies
  // without mutating any state or applying cooldown checks.
  private computeNext(
    aggregates: AggregatePattern[],
    anomalies: AnomalyReport[],
  ): TunableConfig {
    const next: TunableConfig = {
      circuitBreaker: { ...this.currentConfig.circuitBreaker },
      bulkhead: { ...this.currentConfig.bulkhead },
      httpClient: { ...this.currentConfig.httpClient },
    };

    // Tune httpClient.timeoutMs based on p95 latency
    const maxP95 = Math.max(...aggregates.map((a) => a.p95Ms));
    const targetTimeout = Math.min(
      Math.max(maxP95 * 2, this.config.minTimeoutMs),
      this.config.maxTimeoutMs,
    );

    if (Math.abs(targetTimeout - next.httpClient.timeoutMs) > this.config.adjustmentStepMs) {
      next.httpClient.timeoutMs = this.smoothValue(next.httpClient.timeoutMs, targetTimeout);
    }

    // Tune httpClient.maxRetries based on error rate
    const avgErrorRate =
      aggregates.reduce((sum, a) => sum + a.errorRate, 0) / aggregates.length;

    if (avgErrorRate > 0.1) {
      next.httpClient.maxRetries = Math.min(next.httpClient.maxRetries + 1, 5);
    } else if (avgErrorRate < 0.01 && next.httpClient.maxRetries > 1) {
      next.httpClient.maxRetries = Math.max(next.httpClient.maxRetries - 1, 0);
    }

    // Tune circuitBreaker.failureThreshold based on anomalies (0–100 scale)
    const criticalAnomalies = anomalies.filter(
      (a) => a.severity === 'critical' || a.severity === 'high',
    ).length;

    if (criticalAnomalies > 0) {
      next.circuitBreaker.failureThreshold = Math.max(
        this.currentConfig.circuitBreaker.failureThreshold - 10 * criticalAnomalies,
        10,
      );
    } else if (anomalies.length === 0) {
      next.circuitBreaker.failureThreshold = Math.min(
        this.currentConfig.circuitBreaker.failureThreshold + 5,
        80,
      );
    }

    return next;
  }

  private diffSections(prev: TunableConfig, next: TunableConfig): Set<keyof TunableConfig> {
    const changed = new Set<keyof TunableConfig>();
    for (const key of Object.keys(next) as Array<keyof TunableConfig>) {
      if (JSON.stringify(next[key]) !== JSON.stringify(prev[key])) {
        changed.add(key);
      }
    }
    return changed;
  }

  private smoothValue(current: number, target: number): number {
    return current + (target - current) * this.config.smoothingFactor;
  }
}
