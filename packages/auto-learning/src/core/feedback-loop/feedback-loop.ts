import { ok, fail } from '@backendkit-labs/result';
import type { Result } from '@backendkit-labs/result';
import { v4 as uuid } from 'uuid';
import { IFeedbackLoop, FeedbackLoopConfig, DEFAULT_LOOP_CONFIG } from './types.js';
import { LearningCycleEvent } from '../types.js';
import { LearningError, storageError } from '../errors.js';
import { IPatternRegistry } from '../pattern-registry/types.js';
import { IAnomalyDetector } from '../anomaly-detector/types.js';
import { IConfigTuner } from '../config-tuner/types.js';
import { StorageAdapter } from '../persistence/storage-adapter.js';
import { ObservabilityAdapter } from '../observability/observability-adapter.js';

export class FeedbackLoop implements IFeedbackLoop {
  private timerId: ReturnType<typeof setInterval> | null = null;
  private readonly config: FeedbackLoopConfig;
  private cycleListeners: Array<(event: LearningCycleEvent) => void> = [];

  constructor(
    private readonly patternRegistry: IPatternRegistry,
    private readonly anomalyDetector: IAnomalyDetector,
    private readonly configTuner: IConfigTuner,
    private readonly storage: StorageAdapter,
    private readonly observability: ObservabilityAdapter,
    loopConfig?: Partial<FeedbackLoopConfig>,
  ) {
    this.config = { ...DEFAULT_LOOP_CONFIG, ...loopConfig };
  }

  start(intervalMs?: number): void {
    if (this.timerId !== null) {
      this.observability.warn('Feedback loop already running, ignoring start');
      return;
    }

    const interval = intervalMs ?? this.config.defaultIntervalMs;
    this.observability.info('Feedback loop started', { intervalMs: interval });

    this.timerId = setInterval(() => {
      this.runOnce().then((result) => {
        if (!result.ok) {
          this.observability.error('Feedback loop cycle failed', {
            error: result.error,
          });
        }
      });
    }, interval);
  }

  stop(): void {
    if (this.timerId === null) {
      this.observability.warn('Feedback loop not running, ignoring stop');
      return;
    }

    clearInterval(this.timerId);
    this.timerId = null;
    this.observability.info('Feedback loop stopped');
  }

  isRunning(): boolean {
    return this.timerId !== null;
  }

  async runOnce(): Promise<Result<LearningCycleEvent, LearningError>> {
    const cycleId = uuid();
    const startTime = Date.now();

    this.observability.debug('Feedback cycle started', { cycleId });

    // Step 1: Collect patterns from the window
    const patternsResult = this.storage.getPatterns(
      new Date(Date.now() - this.config.windowSizeMinutes * 60_000),
      new Date(),
    );

    if (!patternsResult.ok) {
      return fail(storageError('Failed to collect patterns', patternsResult.error));
    }

    const patterns = patternsResult.value;
    if (patterns.length < this.config.minSamplesBeforeTuning) {
      this.observability.debug('Skipping cycle: insufficient samples', {
        actual: patterns.length,
        required: this.config.minSamplesBeforeTuning,
      });

      const skippedEvent: LearningCycleEvent = {
        cycleId,
        timestamp: new Date(),
        patternsProcessed: patterns.length,
        anomaliesFound: 0,
        configChanges: {},
        durationMs: Date.now() - startTime,
      };

      return ok(skippedEvent);
    }

    // Step 2: Get aggregates
    const aggregatesResult = this.patternRegistry.getAggregates(
      this.config.windowSizeMinutes,
    );

    if (!aggregatesResult.ok) {
      return fail(aggregatesResult.error);
    }

    const aggregates = aggregatesResult.value;

    // Step 3: Detect anomalies
    const anomaliesResult = this.anomalyDetector.batchAnalyze(patterns, aggregates);

    if (!anomaliesResult.ok) {
      return fail(anomaliesResult.error);
    }

    const anomalies = anomaliesResult.value;

    // Persist anomalies
    for (const anomaly of anomalies) {
      this.storage.saveAnomaly(anomaly);
    }

    // Log anomalies
    if (anomalies.length > 0) {
      this.observability.warn('Anomalies detected', {
        count: anomalies.length,
        severities: anomalies.map((a) => a.severity),
      });
      this.observability.incrementMetric('anomalies.detected', anomalies.length);
    }

    // Step 4: Tune config
    const tuneResult = this.configTuner.tune(aggregates, anomalies);

    if (!tuneResult.ok) {
      return fail(tuneResult.error);
    }

    const newConfig = tuneResult.value;
    const previousConfig = this.configTuner.getCurrentConfig();

    // Compute config changes
    const configChanges: Record<string, unknown> = {};
    const configKeys = Object.keys(newConfig) as Array<keyof typeof newConfig>;
    for (const key of configKeys) {
      if (newConfig[key] !== previousConfig[key]) {
        configChanges[key] = newConfig[key];
      }
    }

    // Step 5: Build and persist cycle event
    const cycleEvent: LearningCycleEvent = {
      cycleId,
      timestamp: new Date(),
      patternsProcessed: patterns.length,
      anomaliesFound: anomalies.length,
      configChanges,
      durationMs: Date.now() - startTime,
    };

    const saveResult = this.storage.saveCycleEvent(cycleEvent);
    if (!saveResult.ok) {
      this.observability.error('Failed to save cycle event', { error: saveResult.error });
      return fail(saveResult.error);
    }

    // Emit to listeners
    for (const listener of this.cycleListeners) {
      listener(cycleEvent);
    }

    this.observability.info('Feedback cycle completed', {
      cycleId,
      patternsProcessed: cycleEvent.patternsProcessed,
      anomaliesFound: cycleEvent.anomaliesFound,
      durationMs: cycleEvent.durationMs,
    });

    this.observability.histogramMetric('cycle.duration_ms', cycleEvent.durationMs);
    this.observability.gaugeMetric('cycle.patterns_count', cycleEvent.patternsProcessed);

    return ok(cycleEvent);
  }

  onCycle(callback: (event: LearningCycleEvent) => void): void {
    this.cycleListeners.push(callback);
  }
}
