import { isOk, isFail } from '@backendkit-labs/result';
import { SagaStateMachine } from '../../../src/state-machine/saga-state-machine';
import { SagaStatus } from '../../../src/types/saga.types';
import type { SagaState } from '../../../src/types/saga.types';

function createState(overrides?: Partial<SagaState>): SagaState {
  return {
    id: 'test-saga-id' as any,
    sagaType: 'test',
    status: SagaStatus.PENDING,
    correlationId: 'corr-1',
    steps: [],
    currentStepIndex: 0,
    createdAt: 1000,
    updatedAt: 1000,
    metadata: {},
    version: 1,
    ...overrides,
  };
}

describe('SagaStateMachine', () => {
  describe('isValidTransition', () => {
    it('should allow PENDING -> RUNNING', () => {
      expect(SagaStateMachine.isValidTransition(SagaStatus.PENDING, SagaStatus.RUNNING)).toBe(true);
    });

    it('should allow RUNNING -> STEP_EXECUTING', () => {
      expect(SagaStateMachine.isValidTransition(SagaStatus.RUNNING, SagaStatus.STEP_EXECUTING)).toBe(true);
    });

    it('should allow RUNNING -> COMPENSATING', () => {
      expect(SagaStateMachine.isValidTransition(SagaStatus.RUNNING, SagaStatus.COMPENSATING)).toBe(true);
    });

    it('should allow RUNNING -> PAUSED', () => {
      expect(SagaStateMachine.isValidTransition(SagaStatus.RUNNING, SagaStatus.PAUSED)).toBe(true);
    });

    it('should allow RUNNING -> COMPLETED', () => {
      expect(SagaStateMachine.isValidTransition(SagaStatus.RUNNING, SagaStatus.COMPLETED)).toBe(true);
    });

    it('should allow STEP_EXECUTING -> RUNNING', () => {
      expect(SagaStateMachine.isValidTransition(SagaStatus.STEP_EXECUTING, SagaStatus.RUNNING)).toBe(true);
    });

    it('should allow STEP_EXECUTING -> COMPENSATING', () => {
      expect(SagaStateMachine.isValidTransition(SagaStatus.STEP_EXECUTING, SagaStatus.COMPENSATING)).toBe(true);
    });

    it('should allow COMPENSATING -> COMPENSATION_DONE', () => {
      expect(SagaStateMachine.isValidTransition(SagaStatus.COMPENSATING, SagaStatus.COMPENSATION_DONE)).toBe(true);
    });

    it('should allow COMPENSATION_DONE -> FAILED', () => {
      expect(SagaStateMachine.isValidTransition(SagaStatus.COMPENSATION_DONE, SagaStatus.FAILED)).toBe(true);
    });

    it('should allow COMPENSATION_DONE -> PARTIALLY_COMPENSATED', () => {
      expect(SagaStateMachine.isValidTransition(SagaStatus.COMPENSATION_DONE, SagaStatus.PARTIALLY_COMPENSATED)).toBe(true);
    });

    it('should allow PAUSED -> RUNNING', () => {
      expect(SagaStateMachine.isValidTransition(SagaStatus.PAUSED, SagaStatus.RUNNING)).toBe(true);
    });

    it('should allow PAUSED -> COMPENSATING', () => {
      expect(SagaStateMachine.isValidTransition(SagaStatus.PAUSED, SagaStatus.COMPENSATING)).toBe(true);
    });

    it('should reject COMPLETED -> any', () => {
      expect(SagaStateMachine.isValidTransition(SagaStatus.COMPLETED, SagaStatus.RUNNING)).toBe(false);
      expect(SagaStateMachine.isValidTransition(SagaStatus.COMPLETED, SagaStatus.PAUSED)).toBe(false);
    });

    it('should reject FAILED -> any', () => {
      expect(SagaStateMachine.isValidTransition(SagaStatus.FAILED, SagaStatus.RUNNING)).toBe(false);
      expect(SagaStateMachine.isValidTransition(SagaStatus.FAILED, SagaStatus.PENDING)).toBe(false);
    });

    it('should reject PARTIALLY_COMPENSATED -> any', () => {
      expect(SagaStateMachine.isValidTransition(SagaStatus.PARTIALLY_COMPENSATED, SagaStatus.RUNNING)).toBe(false);
    });

    it('should reject PENDING -> COMPLETED (skip RUNNING)', () => {
      expect(SagaStateMachine.isValidTransition(SagaStatus.PENDING, SagaStatus.COMPLETED)).toBe(false);
    });

    it('should reject PENDING -> COMPENSATING', () => {
      expect(SagaStateMachine.isValidTransition(SagaStatus.PENDING, SagaStatus.COMPENSATING)).toBe(false);
    });

    it('should reject COMPENSATING -> RUNNING', () => {
      expect(SagaStateMachine.isValidTransition(SagaStatus.COMPENSATING, SagaStatus.RUNNING)).toBe(false);
    });

    it('should reject COMPENSATION_DONE -> COMPENSATING', () => {
      expect(SagaStateMachine.isValidTransition(SagaStatus.COMPENSATION_DONE, SagaStatus.COMPENSATING)).toBe(false);
    });
  });

  describe('transition', () => {
    it('should return Ok with updated state for valid transition', () => {
      const state = createState({ status: SagaStatus.PENDING, version: 1 });
      const result = SagaStateMachine.transition(state, SagaStatus.RUNNING);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.status).toBe(SagaStatus.RUNNING);
        expect(result.value.version).toBe(2);
        expect(result.value.updatedAt).toBeGreaterThan(0);
        expect(result.value.completedAt).toBeUndefined();
      }
    });

    it('should set completedAt for terminal state COMPLETED', () => {
      const state = createState({ status: SagaStatus.RUNNING, version: 3 });
      const result = SagaStateMachine.transition(state, SagaStatus.COMPLETED);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.status).toBe(SagaStatus.COMPLETED);
        expect(result.value.completedAt).toBeGreaterThan(0);
      }
    });

    it('should set completedAt for terminal state FAILED', () => {
      const state = createState({ status: SagaStatus.COMPENSATION_DONE, version: 5 });
      const result = SagaStateMachine.transition(state, SagaStatus.FAILED);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.status).toBe(SagaStatus.FAILED);
        expect(result.value.completedAt).toBeGreaterThan(0);
      }
    });

    it('should set completedAt for terminal state PARTIALLY_COMPENSATED', () => {
      const state = createState({ status: SagaStatus.COMPENSATION_DONE, version: 5 });
      const result = SagaStateMachine.transition(state, SagaStatus.PARTIALLY_COMPENSATED);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.status).toBe(SagaStatus.PARTIALLY_COMPENSATED);
        expect(result.value.completedAt).toBeGreaterThan(0);
      }
    });

    it('should return Fail with INVALID_TRANSITION for invalid transition', () => {
      const state = createState({ status: SagaStatus.PENDING });
      const result = SagaStateMachine.transition(state, SagaStatus.COMPLETED);

      expect(isFail(result)).toBe(true);
      if (isFail(result)) {
        expect((result.error as any).category).toBe('INVALID_TRANSITION');
        expect((result.error as any).from).toBe(SagaStatus.PENDING);
        expect((result.error as any).to).toBe(SagaStatus.COMPLETED);
      }
    });

    it('should return Fail for transition from terminal state', () => {
      const state = createState({ status: SagaStatus.COMPLETED });
      const result = SagaStateMachine.transition(state, SagaStatus.RUNNING);

      expect(isFail(result)).toBe(true);
      if (isFail(result)) {
        expect((result.error as any).category).toBe('INVALID_TRANSITION');
      }
    });

    it('should preserve other fields during transition', () => {
      const state = createState({
        id: 'my-saga' as any,
        sagaType: 'order-flow',
        correlationId: 'corr-x',
        metadata: { key: 'val' },
        status: SagaStatus.PENDING,
        version: 1,
      });

      const result = SagaStateMachine.transition(state, SagaStatus.RUNNING);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.id).toBe('my-saga');
        expect(result.value.sagaType).toBe('order-flow');
        expect(result.value.correlationId).toBe('corr-x');
        expect(result.value.metadata).toEqual({ key: 'val' });
      }
    });
  });

  describe('canExecuteStep', () => {
    it('should return true when status is RUNNING', () => {
      expect(SagaStateMachine.canExecuteStep(createState({ status: SagaStatus.RUNNING }))).toBe(true);
    });

    it('should return false when status is PENDING', () => {
      expect(SagaStateMachine.canExecuteStep(createState({ status: SagaStatus.PENDING }))).toBe(false);
    });

    it('should return false when status is COMPLETED', () => {
      expect(SagaStateMachine.canExecuteStep(createState({ status: SagaStatus.COMPLETED }))).toBe(false);
    });

    it('should return false when status is COMPENSATING', () => {
      expect(SagaStateMachine.canExecuteStep(createState({ status: SagaStatus.COMPENSATING }))).toBe(false);
    });

    it('should return false when status is PAUSED', () => {
      expect(SagaStateMachine.canExecuteStep(createState({ status: SagaStatus.PAUSED }))).toBe(false);
    });
  });

  describe('canCompensate', () => {
    it('should return true when status is RUNNING', () => {
      expect(SagaStateMachine.canCompensate(createState({ status: SagaStatus.RUNNING }))).toBe(true);
    });

    it('should return true when status is STEP_EXECUTING', () => {
      expect(SagaStateMachine.canCompensate(createState({ status: SagaStatus.STEP_EXECUTING }))).toBe(true);
    });

    it('should return true when status is PAUSED', () => {
      expect(SagaStateMachine.canCompensate(createState({ status: SagaStatus.PAUSED }))).toBe(true);
    });

    it('should return false when status is PENDING', () => {
      expect(SagaStateMachine.canCompensate(createState({ status: SagaStatus.PENDING }))).toBe(false);
    });

    it('should return false when status is COMPLETED', () => {
      expect(SagaStateMachine.canCompensate(createState({ status: SagaStatus.COMPLETED }))).toBe(false);
    });

    it('should return false when status is FAILED', () => {
      expect(SagaStateMachine.canCompensate(createState({ status: SagaStatus.FAILED }))).toBe(false);
    });
  });
});
