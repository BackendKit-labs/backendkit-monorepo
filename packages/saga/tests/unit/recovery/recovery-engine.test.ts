import { ok, fail, isOk, isFail } from '@backendkit-labs/result';
import { RecoveryEngine } from '../../../src/recovery/recovery-engine';
import { SagaStatus } from '../../../src/types/saga.types';
import type { SagaState } from '../../../src/types/saga.types';
import type { SagaStore } from '../../../src/persistence/saga-store.interface';
import type { SagaEngine } from '../../../src/core/saga-engine';

vi.mock('../../../src/utils/time', () => ({
  currentTimestamp: vi.fn(() => 5000),
}));

function createSagaState(overrides?: Partial<SagaState>): SagaState {
  return {
    id: 'saga-recover-1' as any,
    sagaType: 'test',
    status: SagaStatus.RUNNING,
    correlationId: 'corr-1',
    steps: [],
    currentStepIndex: 1,
    createdAt: 1000,
    updatedAt: 2000,
    metadata: {},
    version: 3,
    lockExpiresAt: 3000, // expired (now is 5000)
    ...overrides,
  };
}

function createMockStore(): Mocked<SagaStore> {
  return {
    save: vi.fn().mockResolvedValue(ok(undefined)),
    load: vi.fn().mockResolvedValue(ok(createSagaState())),
    list: vi.fn().mockResolvedValue(ok([])),
    delete: vi.fn().mockResolvedValue(ok(undefined)),
  };
}

function createMockEngine(): Mocked<Pick<SagaEngine, 'resume'>> {
  return {
    resume: vi.fn().mockResolvedValue(ok({ sagaId: 'saga-1', status: SagaStatus.COMPLETED, timeline: [] })),
  } as any;
}

describe('RecoveryEngine', () => {
  let store: Mocked<SagaStore>;
  let engine: Mocked<Pick<SagaEngine, 'resume'>>;

  beforeEach(() => {
    store = createMockStore();
    engine = createMockEngine();
  });

  describe('recoverCrashedSagas', () => {
    it('should return 0 when no crashed sagas exist', async () => {
      store.list.mockResolvedValue(ok([]));

      const recovery = new RecoveryEngine(store as any, engine as any);
      const result = await recovery.recoverCrashedSagas();

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(0);
      }
    });

    it('should scan across all crashed statuses', async () => {
      store.list.mockResolvedValue(ok([]));

      const recovery = new RecoveryEngine(store as any, engine as any);
      await recovery.recoverCrashedSagas();

      // Should query for RUNNING, STEP_EXECUTING, COMPENSATING
      expect(store.list).toHaveBeenCalledTimes(3);
      expect(store.list).toHaveBeenCalledWith({ status: SagaStatus.RUNNING });
      expect(store.list).toHaveBeenCalledWith({ status: SagaStatus.STEP_EXECUTING });
      expect(store.list).toHaveBeenCalledWith({ status: SagaStatus.COMPENSATING });
    });

    it('should recover a saga with expired lock', async () => {
      const saga = createSagaState({
        id: 'saga-expired' as any,
        lockExpiresAt: 3000, // expired
      });

      store.list.mockResolvedValueOnce(ok([saga]));
      store.list.mockResolvedValue(ok([])); // other statuses return empty

      const recovery = new RecoveryEngine(store as any, engine as any);
      const result = await recovery.recoverCrashedSagas();

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(1);
      }

      expect(engine.resume).toHaveBeenCalledWith('saga-expired');
    });

    it('should NOT recover a saga with active lock', async () => {
      const saga = createSagaState({
        id: 'saga-active-lock' as any,
        lockExpiresAt: 6000, // still active (now is 5000)
      });

      store.list.mockResolvedValueOnce(ok([saga]));
      store.list.mockResolvedValue(ok([]));

      const recovery = new RecoveryEngine(store as any, engine as any);
      const result = await recovery.recoverCrashedSagas();

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(0);
      }

      expect(engine.resume).not.toHaveBeenCalled();
    });

    it('should recover saga without lockExpiresAt (no lock set)', async () => {
      const saga = createSagaState({
        id: 'saga-no-lock' as any,
        lockExpiresAt: undefined,
      });

      store.list.mockResolvedValueOnce(ok([saga]));
      store.list.mockResolvedValue(ok([]));

      const recovery = new RecoveryEngine(store as any, engine as any);
      const result = await recovery.recoverCrashedSagas();

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(1);
      }

      expect(engine.resume).toHaveBeenCalledWith('saga-no-lock');
    });

    it('should skip sagas that fail to resume', async () => {
      const saga = createSagaState({ id: 'saga-fail-resume' as any });
      store.list.mockResolvedValueOnce(ok([saga]));
      store.list.mockResolvedValue(ok([]));

      engine.resume.mockResolvedValue(
        fail({ category: 'INVALID_TRANSITION', from: SagaStatus.RUNNING, to: SagaStatus.RUNNING }),
      );

      const recovery = new RecoveryEngine(store as any, engine as any);
      const result = await recovery.recoverCrashedSagas();

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(0);
      }
    });

    it('should propagate store list failure', async () => {
      store.list.mockResolvedValue(
        fail({ category: 'PERSISTENCE_ERROR', cause: new Error('DB error') }),
      );

      const recovery = new RecoveryEngine(store as any, engine as any);
      const result = await recovery.recoverCrashedSagas();

      expect(isFail(result)).toBe(true);
      if (isFail(result)) {
        expect((result.error as any).category).toBe('PERSISTENCE_ERROR');
      }
    });

    it('should recover multiple sagas from different statuses', async () => {
      const runningSaga = createSagaState({
        id: 'saga-running' as any,
        status: SagaStatus.RUNNING,
        lockExpiresAt: 3000,
      });
      const executingSaga = createSagaState({
        id: 'saga-executing' as any,
        status: SagaStatus.STEP_EXECUTING,
        lockExpiresAt: 3000,
      });

      store.list
        .mockResolvedValueOnce(ok([runningSaga]))
        .mockResolvedValueOnce(ok([executingSaga]))
        .mockResolvedValueOnce(ok([]));

      engine.resume
        .mockResolvedValueOnce(ok({ sagaId: 'saga-running' as any, status: SagaStatus.COMPLETED, timeline: [] }))
        .mockResolvedValueOnce(ok({ sagaId: 'saga-executing' as any, status: SagaStatus.COMPLETED, timeline: [] }));

      const recovery = new RecoveryEngine(store as any, engine as any);
      const result = await recovery.recoverCrashedSagas();

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(2);
      }
    });
  });
});
