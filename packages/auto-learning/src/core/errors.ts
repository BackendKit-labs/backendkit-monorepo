export type StorageError = {
  readonly tag: 'STORAGE_ERROR';
  readonly message: string;
  readonly cause?: unknown;
};

export type InsufficientDataError = {
  readonly tag: 'INSUFFICIENT_DATA';
  readonly message: string;
  readonly required: number;
  readonly actual: number;
};

export type InvalidConfigError = {
  readonly tag: 'INVALID_CONFIG';
  readonly message: string;
  readonly key: string;
  readonly value: unknown;
};

export type AnomalyDetectionFailedError = {
  readonly tag: 'ANOMALY_DETECTION_FAILED';
  readonly message: string;
};

export type FeedbackLoopAlreadyRunningError = {
  readonly tag: 'FEEDBACK_LOOP_ALREADY_RUNNING';
  readonly message: string;
};

export type FeedbackLoopNotRunningError = {
  readonly tag: 'FEEDBACK_LOOP_NOT_RUNNING';
  readonly message: string;
};

export type LearningError =
  | StorageError
  | InsufficientDataError
  | InvalidConfigError
  | AnomalyDetectionFailedError
  | FeedbackLoopAlreadyRunningError
  | FeedbackLoopNotRunningError;

export const storageError = (message: string, cause?: unknown): StorageError =>
  ({ tag: 'STORAGE_ERROR', message, cause });

export const insufficientData = (required: number, actual: number): InsufficientDataError =>
  ({ tag: 'INSUFFICIENT_DATA', message: `Insufficient data: required ${required}, got ${actual}`, required, actual });

export const invalidConfig = (key: string, value: unknown): InvalidConfigError =>
  ({ tag: 'INVALID_CONFIG', message: `Invalid config for key: ${key}`, key, value });

export const anomalyDetectionFailed = (message: string): AnomalyDetectionFailedError =>
  ({ tag: 'ANOMALY_DETECTION_FAILED', message });

export const feedbackLoopAlreadyRunning = (): FeedbackLoopAlreadyRunningError =>
  ({ tag: 'FEEDBACK_LOOP_ALREADY_RUNNING', message: 'Feedback loop is already running' });

export const feedbackLoopNotRunning = (): FeedbackLoopNotRunningError =>
  ({ tag: 'FEEDBACK_LOOP_NOT_RUNNING', message: 'Feedback loop is not running' });
