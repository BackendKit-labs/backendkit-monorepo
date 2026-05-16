// Core (framework-agnostic)
export { AutoLearningCore, PatternRegistry, AnomalyDetector, ConfigTuner, FeedbackLoop, InMemoryStorage, FileStorageAdapter, NoopObservabilityAdapter } from './core/index.js';
export type { AutoLearningCoreOptions, EndpointPattern, AggregatePattern, AnomalySeverity, AnomalyReport, TunableConfig, LearningCycleEvent, LearningError, IPatternRegistry, RegistryStats, IAnomalyDetector, AnomalyDetectorConfig, IConfigTuner, ConfigTunerConfig, IFeedbackLoop, FeedbackLoopConfig, StorageAdapter, ObservabilityAdapter } from './core/index.js';
export { DEFAULT_ANOMALY_CONFIG, DEFAULT_TUNER_CONFIG, DEFAULT_LOOP_CONFIG } from './core/index.js';

// NestJS integration
export { AutoLearningModule, AutoLearn, AUTO_LEARNING_INSTANCE, AUTO_LEARNING_OPTIONS, AUTO_LEARN_METADATA } from './nestjs/index.js';
export type { AutoLearningModuleOptions, AutoLearnOptions } from './nestjs/index.js';
