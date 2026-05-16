import { fail } from '@backendkit-labs/result';

export type LearningErrorTag =
  | 'STORAGE_ERROR'
  | 'INSUFFICIENT_DATA'
  | 'INVALID_CONFIG'
  | 'ANOMALY_DETECTION_FAILED'
  | 'FEEDBACK_LOOP_ALREADY_RUNNING'
  | 'FEEDBACK_LOOP_NOT_RUNNING';

export type LearningError = {
  readonly tag: LearningErrorTag;
  readonly message: string;
  readonly cause?: unknown;
  readonly required?: number;
  readonly actual?: number;
  readonly key?: string;
  readonly value?: unknown;
};

export const storageError = (message: string, cause?: unknown): LearningError =>
  ({ tag: 'STORAGE_ERROR', message, cause });

export const insufficientData = (required: number, actual: number): LearningError =>
  ({ tag: 'INSUFFICIENT_DATA', message: `Insufficient data: required ${required}, got ${actual}`, required, actual });

export const invalidConfig = (key: string, value: unknown): LearningError =>
  ({ tag: 'INVALID_CONFIG', message: `Invalid config for key: ${key}`, key, value });

export const anomalyDetectionFailed = (message: string): LearningError =>
  ({ tag: 'ANOMALY_DETECTION_FAILED', message });

export const feedbackLoopAlreadyRunning = (): LearningError =>
  ({ tag: 'FEEDBACK_LOOP_ALREADY_RUNNING', message: 'Feedback loop is already running' });

export const feedbackLoopNotRunning = (): LearningError =>
  ({ tag: 'FEEDBACK_LOOP_NOT_RUNNING', message: 'Feedback loop is not running' });
