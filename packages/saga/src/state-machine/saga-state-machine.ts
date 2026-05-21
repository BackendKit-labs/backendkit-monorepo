// ---------------------------------------------------------------------------
// @backendkit-labs/saga — src/state-machine/saga-state-machine.ts
//
// Pure state machine: validates transitions, applies them, checks execution
// and compensation eligibility. No side effects — all static methods.
// ---------------------------------------------------------------------------

import { SagaStatus } from '../types/saga.types';
import type { SagaState } from '../types/saga.types';
import { ok, fail } from '@backendkit-labs/result';
import type { SagaResult } from '../types/error.types';

// Allowed transitions: Map<from, Set<to>>
const TRANSITIONS: Record<SagaStatus, Set<SagaStatus>> = {
  [SagaStatus.PENDING]: new Set([SagaStatus.RUNNING]),

  [SagaStatus.RUNNING]: new Set([
    SagaStatus.STEP_EXECUTING,
    SagaStatus.WAITING_FOR_EVENT,
    SagaStatus.COMPENSATING,
    SagaStatus.PAUSED,
    SagaStatus.COMPLETED,
  ]),

  [SagaStatus.STEP_EXECUTING]: new Set([
    SagaStatus.RUNNING,
    SagaStatus.WAITING_FOR_EVENT,
    SagaStatus.COMPENSATING,
  ]),

  [SagaStatus.WAITING_FOR_EVENT]: new Set([
    SagaStatus.RUNNING,       // signal received
    SagaStatus.COMPENSATING,  // timeout expired
  ]),

  [SagaStatus.COMPENSATING]: new Set([SagaStatus.COMPENSATION_DONE]),

  [SagaStatus.COMPENSATION_DONE]: new Set([
    SagaStatus.FAILED,
    SagaStatus.PARTIALLY_COMPENSATED,
  ]),

  [SagaStatus.PAUSED]: new Set([
    SagaStatus.RUNNING,
    SagaStatus.COMPENSATING,
  ]),

  // Terminal states: no valid outgoing transitions
  [SagaStatus.COMPLETED]: new Set(),
  [SagaStatus.FAILED]: new Set(),
  [SagaStatus.PARTIALLY_COMPENSATED]: new Set(),
};

const TERMINAL_STATUSES: ReadonlySet<SagaStatus> = new Set([
  SagaStatus.COMPLETED,
  SagaStatus.FAILED,
  SagaStatus.PARTIALLY_COMPENSATED,
]);

export class SagaStateMachine {
  static isValidTransition(from: SagaStatus, to: SagaStatus): boolean {
    return TRANSITIONS[from]?.has(to) === true;
  }

  static transition(state: SagaState, to: SagaStatus): SagaResult<SagaState> {
    if (!SagaStateMachine.isValidTransition(state.status, to)) {
      return fail({
        category: 'INVALID_TRANSITION',
        from: state.status,
        to,
      });
    }

    const now = Date.now();
    const updated: SagaState = {
      ...state,
      status: to,
      updatedAt: now,
      completedAt: TERMINAL_STATUSES.has(to) ? now : state.completedAt,
      version: state.version + 1,
    };

    return ok(updated);
  }

  static canExecuteStep(state: SagaState): boolean {
    return state.status === SagaStatus.RUNNING;
  }

  static canCompensate(state: SagaState): boolean {
    return (
      state.status === SagaStatus.RUNNING ||
      state.status === SagaStatus.STEP_EXECUTING ||
      state.status === SagaStatus.WAITING_FOR_EVENT ||
      state.status === SagaStatus.PAUSED
    );
  }
}
