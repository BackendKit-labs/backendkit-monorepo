import type { Result } from '@backendkit-labs/result';
import { LearningCycleEvent } from '../types.js';
import { LearningError } from '../errors.js';

export interface IFeedbackLoop {
  start(intervalMs?: number): void;
  stop(): void;
  isRunning(): boolean;
  runOnce(): Promise<Result<LearningCycleEvent, LearningError>>;
  onCycle(callback: (event: LearningCycleEvent) => void): void;
}

export type FeedbackLoopConfig = {
  defaultIntervalMs: number;
  windowSizeMinutes: number;
  minSamplesBeforeTuning: number;
  cooldownBetweenChangesMs: number;
  /** Hours to retain patterns and anomalies. Records older than this are pruned after each cycle. Default: 24 */
  pruneTtlHours: number;
};

export const DEFAULT_LOOP_CONFIG: FeedbackLoopConfig = {
  defaultIntervalMs: 60_000,
  windowSizeMinutes: 5,
  minSamplesBeforeTuning: 10,
  cooldownBetweenChangesMs: 120_000,
  pruneTtlHours: 24,
};
