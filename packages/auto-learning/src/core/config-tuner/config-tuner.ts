import { ok, fail } from '@backendkit-labs/result';
import type { Result } from '@backendkit-labs/result';
import { IConfigTuner, ConfigTunerConfig, DEFAULT_TUNER_CONFIG } from './types.js';
import { TunableConfig, AggregatePattern, AnomalyReport } from '../types.js';
import { LearningError, storageError } from '../errors.js';
import { StorageAdapter } from '../persistence/storage-adapter.js';
import { ObservabilityAdapter } from '../observability/observability-adapter.js';

const DEFAULT_CONFIG: TunableConfig = {
  timeoutMs: 10000,
  maxRetries: 3,
  circuitBreakerThreshold: 0.5,
  circuitBreakerHalfOpenAfterMs: 30000,
  bulkheadMaxConcurrent: 10,
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
    return { ...this.currentConfig };
  }

  tune(
    aggregates: AggregatePattern[],
    anomalies: AnomalyReport[],
  ): Result<TunableConfig, LearningError> {
    if (aggregates.length === 0) {
      return ok(this.getCurrentConfig());
    }

    const newConfig = { ...this.currentConfig };
    const changes: Partial<Record<string, unknown>> = {};

    // Tune timeout based on p95 latency
    const maxP95 = Math.max(...aggregates.map((a) => a.p95Ms));
    const targetTimeout = Math.min(
      Math.max(maxP95 * 2, this.config.minTimeoutMs),
      this.config.maxTimeoutMs,
    );

    if (Math.abs(targetTimeout - newConfig.timeoutMs) > this.config.adjustmentStepMs) {
      newConfig.timeoutMs = this.smoothValue(
        newConfig.timeoutMs,
        targetTimeout,
      );
      changes.timeoutMs = newConfig.timeoutMs;
    }

    // Tune maxRetries based on error rate
    const avgErrorRate =
      aggregates.reduce((sum, a) => sum + a.errorRate, 0) / aggregates.length;

    if (avgErrorRate > 0.1) {
      newConfig.maxRetries = Math.min(newConfig.maxRetries + 1, 5);
      changes.maxRetries = newConfig.maxRetries;
    } else if (avgErrorRate < 0.01 && newConfig.maxRetries > 1) {
      newConfig.maxRetries = Math.max(newConfig.maxRetries - 1, 0);
      changes.maxRetries = newConfig.maxRetries;
    }

    // Tune circuit breaker threshold based on anomalies
    const criticalAnomalies = anomalies.filter(
      (a) => a.severity === 'critical' || a.severity === 'high',
    ).length;

    if (criticalAnomalies > 0) {
      newConfig.circuitBreakerThreshold = Math.max(
        this.currentConfig.circuitBreakerThreshold - 0.1 * criticalAnomalies,
        0.1,
      );
      changes.circuitBreakerThreshold = newConfig.circuitBreakerThreshold;
    } else if (anomalies.length === 0) {
      newConfig.circuitBreakerThreshold = Math.min(
        this.currentConfig.circuitBreakerThreshold + 0.05,
        0.8,
      );
      changes.circuitBreakerThreshold = newConfig.circuitBreakerThreshold;
    }

    // Apply changes if any
    if (Object.keys(changes).length > 0) {
      const now = Date.now();
      if (now - this.lastChangeAt > 60_000) {
        this.currentConfig = newConfig;
        this.lastChangeAt = now;

        const saveResult = this.storage.saveConfig(newConfig);
        if (!saveResult.ok) {
          return fail(storageError('Failed to save config', saveResult.error));
        }

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
    this.currentConfig = { ...DEFAULT_CONFIG };
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

  onConfigChange(callback: (config: TunableConfig) => void): void {
    this.listeners.push(callback);
  }

  private smoothValue(current: number, target: number): number {
    return current + (target - current) * this.config.smoothingFactor;
  }
}
