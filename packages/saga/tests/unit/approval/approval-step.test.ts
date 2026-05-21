import { ok, fail, isOk, isFail } from '@backendkit-labs/result';
import { ApprovalStep } from '../../../src/approval/approval-step';
import type { ApprovalStore } from '../../../src/types/approval.types';
import type { SagaEventBus } from '../../../src/types/events.types';
import type { StepContext } from '../../../src/types/step.types';

vi.mock('../../../src/utils/id-generator', () => ({
  generateEventId: vi.fn(() => 'approval-id-mock'),
}));

vi.mock('../../../src/utils/time', () => ({
  currentTimestamp: vi.fn(() => 5000),
}));

function createContext(overrides?: Partial<StepContext>): StepContext {
  return {
    sagaId: 'saga-1' as any,
    correlationId: 'corr-1',
    stepName: 'manager-approval',
    attempt: 1,
    input: { amount: 5000 },
    previousOutput: undefined,
    metadata: { tenant: 'acme' },
    ...overrides,
  };
}

function createMockApprovalStore(): Mocked<ApprovalStore> {
  return {
    requestApproval: vi.fn().mockReturnValue(ok(undefined)),
    approve: vi.fn().mockReturnValue(ok(undefined)),
    deny: vi.fn().mockReturnValue(ok(undefined)),
    getStatus: vi.fn().mockReturnValue(ok('PENDING')),
    listPending: vi.fn().mockReturnValue(ok([])),
  };
}

function createMockEventBus(): Mocked<SagaEventBus> {
  return {
    publish: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn().mockReturnValue(vi.fn()),
    unsubscribe: vi.fn(),
    subscribeAll: vi.fn().mockReturnValue(vi.fn()),
  };
}

describe('ApprovalStep', () => {
  describe('createHandler', () => {
    it('should return a StepHandler function', () => {
      const handler = ApprovalStep.createHandler(
        createMockApprovalStore(),
        'manager-group',
        createMockEventBus(),
      );

      expect(typeof handler).toBe('function');
    });

    it('should create approval request and publish event on execution', async () => {
      const approvalStore = createMockApprovalStore();
      const eventBus = createMockEventBus();
      const handler = ApprovalStep.createHandler(approvalStore, 'manager-group', eventBus);

      const result = await handler(createContext());

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toEqual({ approvalId: 'approval-id-mock' });
      }

      expect(approvalStore.requestApproval).toHaveBeenCalledTimes(1);
      const request = approvalStore.requestApproval.mock.calls[0][0];
      expect(request.stepName).toBe('manager-approval');
      expect(request.sagaId).toBe('saga-1');
      expect(request.group).toBe('manager-group');
      expect(request.status).toBe('PENDING');
      expect(request.context.input).toEqual({ amount: 5000 });

      expect(eventBus.publish).toHaveBeenCalledTimes(1);
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'MANUAL_APPROVAL_REQUIRED',
          stepName: 'manager-approval',
          sagaId: 'saga-1',
        }),
      );
    });

    it('should propagate approval store failure', async () => {
      const approvalStore = createMockApprovalStore();
      const eventBus = createMockEventBus();
      approvalStore.requestApproval.mockReturnValue(
        fail({ category: 'PERSISTENCE_ERROR', cause: new Error('store unavailable') }),
      );

      const handler = ApprovalStep.createHandler(approvalStore, 'group', eventBus);

      const result = await handler(createContext());

      expect(isFail(result)).toBe(true);
      if (isFail(result)) {
        expect((result.error as any).category).toBe('PERSISTENCE_ERROR');
      }

      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('should pass group name correctly', async () => {
      const approvalStore = createMockApprovalStore();
      const eventBus = createMockEventBus();
      const handler = ApprovalStep.createHandler(approvalStore, 'finance-director', eventBus);

      await handler(createContext());

      expect(approvalStore.requestApproval.mock.calls[0][0].group).toBe('finance-director');
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({ group: 'finance-director' }),
        }),
      );
    });

    it('should include metadata in approval request context', async () => {
      const approvalStore = createMockApprovalStore();
      const handler = ApprovalStep.createHandler(approvalStore, 'group', createMockEventBus());

      await handler(createContext({ metadata: { tenant: 'acme', priority: 'high' } }));

      expect(approvalStore.requestApproval.mock.calls[0][0].context.metadata).toEqual({
        tenant: 'acme',
        priority: 'high',
      });
    });
  });
});
