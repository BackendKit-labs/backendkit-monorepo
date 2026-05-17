import type { Result } from '@backendkit-labs/result';
import { EndpointPattern, TunableConfig, LearningCycleEvent } from './types.js';
import { LearningError } from './errors.js';
import { IPatternRegistry, PatternRegistry } from './pattern-registry/index.js';
import { IAnomalyDetector, AnomalyDetector, AnomalyDetectorConfig } from './anomaly-detector/index.js';
import { IConfigTuner, ConfigTuner, ConfigTunerConfig } from './config-tuner/index.js';
import { IFeedbackLoop, FeedbackLoop, FeedbackLoopConfig } from './feedback-loop/index.js';
import { StorageAdapter, InMemoryStorage } from './persistence/index.js';
import { ObservabilityAdapter, NoopObservabilityAdapter } from './observability/index.js';

export type AutoLearningCoreOptions = {
  storage?: StorageAdapter;
  observability?: ObservabilityAdapter;
  anomalyConfig?: Partial<AnomalyDetectorConfig>;
  tunerConfig?: Partial<ConfigTunerConfig>;
  loopConfig?: Partial<FeedbackLoopConfig>;
};

export class AutoLearningCore {
  private constructor(
    public readonly patternRegistry: IPatternRegistry,
    public readonly anomalyDetector: IAnomalyDetector,
    public readonly configTuner: IConfigTuner,
    public readonly feedbackLoop: IFeedbackLoop,
    public readonly storage: StorageAdapter,
    public readonly observability: ObservabilityAdapter,
  ) {}

  static create(options?: AutoLearningCoreOptions): AutoLearningCore {
    const storage = options?.storage ?? new InMemoryStorage();
    const obs = options?.observability ?? new NoopObservabilityAdapter();
    const registry = new PatternRegistry(storage, obs);
    const detector = new AnomalyDetector(options?.anomalyConfig);
    const tuner = new ConfigTuner(storage, obs, options?.tunerConfig);
    const loop = new FeedbackLoop(registry, detector, tuner, storage, obs, options?.loopConfig);

    return new AutoLearningCore(registry, detector, tuner, loop, storage, obs);
  }

  recordPattern(pattern: EndpointPattern): Result<void, LearningError> {
    return this.patternRegistry.record(pattern);
  }

  getCurrentConfig(): TunableConfig {
    return this.configTuner.getCurrentConfig();
  }

  startFeedbackLoop(intervalMs?: number): void {
    this.feedbackLoop.start(intervalMs);
  }

  stopFeedbackLoop(): void {
    this.feedbackLoop.stop();
  }

  isFeedbackLoopRunning(): boolean {
    return this.feedbackLoop.isRunning();
  }

  async runOnce(): Promise<Result<LearningCycleEvent, LearningError>> {
    return this.feedbackLoop.runOnce();
  }

  onConfigChange(callback: (config: TunableConfig) => void): () => void {
    return this.configTuner.onConfigChange(callback);
  }

  onCycle(callback: (event: LearningCycleEvent) => void): () => void {
    return this.feedbackLoop.onCycle(callback);
  }
}
