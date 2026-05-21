// ---------------------------------------------------------------------------
// @backendkit-labs/saga — src/state-machine/step-status.ts
//
// Pure helper functions for StepStatus classification.
// ---------------------------------------------------------------------------

import { StepStatus } from '../types/saga.types';

const TERMINAL_STEP_STATUSES: ReadonlySet<StepStatus> = new Set([
  StepStatus.SUCCEEDED,
  StepStatus.FAILED,
  StepStatus.COMPENSATED,
  StepStatus.COMPENSATION_FAILED,
]);

const FAILURE_STEP_STATUSES: ReadonlySet<StepStatus> = new Set([
  StepStatus.FAILED,
  StepStatus.COMPENSATION_FAILED,
]);

export function isTerminalStepStatus(status: StepStatus): boolean {
  return TERMINAL_STEP_STATUSES.has(status);
}

export function isFailureStepStatus(status: StepStatus): boolean {
  return FAILURE_STEP_STATUSES.has(status);
}
