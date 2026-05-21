import { ok, fail, isOk, isFail } from '@backendkit-labs/result';
import { SagaInstance } from '../../../src/core/saga-instance';
import { SagaStatus, StepStatus } from '../../../src/types/saga.types';
import type { SagaState } from '../../../src/types/saga.types';
import type { SagaDefinition } from '../../../src/core/saga-builder';
import type { SagaStore } from '../../../src/persistence/saga-store.interface';
import type { LockProvider } from '../../../src/types/lock.types';
import type { SagaEventBus } from '../../../src/types/events.types';
import { StepRunner } from '../../../src/core/step-runner';
import { CompensationRunner } from '../../../src/core/compensation-runner';

// Mock timestamps for deterministic testing
let mockTimestamp = 1000;
vi.mock('../../../src/utils/time', () => ({
  currentTimestamp: vi.fn(() => mockTimestamp),
  createTimer: vi.fn((timeoutMs: number) => {
    let timerId: ReturnType<typeof setTimeout> | undefined;
    let rejectPromise: ((reason: unknown) => void) | undefined;

    const promise = new Promise<void>((_, reject) => {
      rejectPromise = reject;
      timerId = setTimeout(() => {
        reject(new Error('Timer timed out'));
        timerId = undefined;
      }, timeoutMs);
    });

    return {
      promise,
      cancel: vi.fn(() => {
        if (timerId !== undefined) {
          clearTimeout(timerId);
          timerId = undefined;
        }
        if (rejectPromise !== undefined) {
          rejectPromise(new Error('Timer cancelled'));
          rejectPromise = undefined;
        }
      }),
    };
  }),
}));

vi.mock('../../../src/utils/id-generator', () => ({
  generateSagaId: vi.fn(() => 'mocked-saga-id'),
  generateCorrelationId: vi.fn(() => 'mocked-corr-id'),
  generateEventId: vi.fn(() => 'mocked-event-id'),
}));


function createState(overrides?: Partial<SagaState>): SagaState {
  return {
    id: 'saga-1' as any,
    sagaType: 'test-saga',
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

function createDefinition(overrides?: Partial<SagaDefinition>): SagaDefinition {
  return {
    name: 'test-saga',
    steps: [],
    ...overrides,
  };
}

function createMockStore(): Mocked<SagaStore> {
  return {
    save: vi.fn().mockResolvedValue(ok(undefined)),
    load: vi.fn().mockResolvedValue(ok(createState())),
    list: vi.fn().mockResolvedValue(ok([])),
    delete: vi.fn().mockResolvedValue(ok(undefined)),
  };
}

function createMockLockProvider(): Mocked<LockProvider> {
  return {
    acquire: vi.fn().mockReturnValue(ok(true)),
    release: vi.fn().mockReturnValue(ok(undefined)),
    isLocked: vi.fn().mockReturnValue(ok(false)),
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

function createMockStepRunner(): Mocked<StepRunner> {
  return {
    execute: vi.fn().mockResolvedValue(ok({ stepName: 'step1', output: { done: true }, durationMs: 10 })),
  } as any;
}

function createMockCompensationRunner(): Mocked<CompensationRunner> {
  return {
    run: vi.fn().mockResolvedValue(ok(undefined)),
  } as any;
}

describe('SagaInstance', () => {
  let store: Mocked<SagaStore>;
  let lockProvider: Mocked<LockProvider>;
  let eventBus: Mocked<SagaEventBus>;
  let stepRunner: Mocked<StepRunner>;
  let compensationRunner: Mocked<CompensationRunner>;

  beforeEach(() => {
    mockTimestamp = 1000;
    store = createMockStore();
    lockProvider = createMockLockProvider();
    eventBus = createMockEventBus();
    stepRunner = createMockStepRunner();
    compensationRunner = createMockCompensationRunner();
  });

  describe('getState', () => {
    it('should return a copy of the current state', () => {
      const state = createState({ status: SagaStatus.RUNNING });
      const instance = new SagaInstance(
        createDefinition(),
        state,
        store,
        lockProvider,
        eventBus,
        stepRunner,
        compensationRunner,
      );

      const returnedState = instance.getState();
      expect(returnedState.status).toBe(SagaStatus.RUNNING);
      expect(returnedState).not.toBe(state); // different reference
    });
  });

  describe('on', () => {
    it('should subscribe to event bus', () => {
      const instance = new SagaInstance(
        createDefinition(),
        createState(),
        store,
        lockProvider,
        eventBus,
        stepRunner,
        compensationRunner,
      );

      const handler = vi.fn();
      instance.on('SAGA_STARTED', handler);

      expect(eventBus.subscribe).toHaveBeenCalledWith('SAGA_STARTED', handler);
    });
  });

  describe('start', () => {
    it('should transition PENDING -> RUNNING and execute steps', async () => {
      const step1 = {
        name: 'step1',
        execute: vi.fn().mockResolvedValue(ok({ data: 'done' })),
      };

      const definition = createDefinition({ steps: [step1] });
      const state = createState({
        status: SagaStatus.PENDING,
        steps: [{ name: 'step1', status: StepStatus.PENDING, attempt: 0 }],
        currentStepIndex: 0,
      });

      stepRunner.execute.mockResolvedValue(ok({ stepName: 'step1', output: { data: 'done' }, durationMs: 10 }));

      const instance = new SagaInstance(
        definition,
        state,
        store,
        lockProvider,
        eventBus,
        stepRunner,
        compensationRunner,
      );

      const result = await instance.start();

      expect(isOk(result)).toBe(true);
      // Lock should be acquired
      expect(lockProvider.acquire).toHaveBeenCalledWith('saga:lock:saga-1', 30000);
      // State should be persisted
      expect(store.save).toHaveBeenCalled();
      // Events should be published
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'SAGA_STARTED' }),
      );
    });

    it('should fail if lock cannot be acquired', async () => {
      lockProvider.acquire.mockReturnValue(ok(false));

      const instance = new SagaInstance(
        createDefinition(),
        createState(),
        store,
        lockProvider,
        eventBus,
        stepRunner,
        compensationRunner,
      );

      const result = await instance.start();

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.status).toBe(SagaStatus.PENDING);
      }
      // Should not execute steps
      expect(stepRunner.execute).not.toHaveBeenCalled();
    });

    it('should fail if lock acquire returns error', async () => {
      lockProvider.acquire.mockReturnValue(
        fail({ category: 'LOCK_ACQUISITION_FAILED', lockKey: 'saga:lock:saga-1' }),
      );

      const instance = new SagaInstance(
        createDefinition(),
        createState(),
        store,
        lockProvider,
        eventBus,
        stepRunner,
        compensationRunner,
      );

      const result = await instance.start();

      expect(isFail(result)).toBe(true);
      if (isFail(result)) {
        expect((result.error as any).category).toBe('LOCK_ACQUISITION_FAILED');
      }
    });

    it('should release lock after completion', async () => {
      const definition = createDefinition();
      const instance = new SagaInstance(
        definition,
        createState({ status: SagaStatus.PENDING }),
        store,
        lockProvider,
        eventBus,
        stepRunner,
        compensationRunner,
      );

      await instance.start();

      expect(lockProvider.release).toHaveBeenCalledWith('saga:lock:saga-1');
    });

    it('should not release lock when acquire fails (never entered try block)', async () => {
      lockProvider.acquire.mockReturnValue(
        fail({ category: 'LOCK_ACQUISITION_FAILED', lockKey: 'saga:lock:saga-1' }),
      );

      const instance = new SagaInstance(
        createDefinition(),
        createState(),
        store,
        lockProvider,
        eventBus,
        stepRunner,
        compensationRunner,
      );

      await instance.start();

      // Release should NOT be called because we never entered the try block
      expect(lockProvider.release).not.toHaveBeenCalled();
    });

    it('should trigger compensation chain when a step fails', async () => {
      const step1 = {
        name: 'step1',
        execute: vi.fn().mockResolvedValue(ok({ data: 'ok' })),
        compensate: vi.fn().mockResolvedValue(ok(undefined)),
      };

      const step2 = {
        name: 'step2',
        execute: vi.fn().mockResolvedValue(ok({ data: 'ok' })),
      };

      stepRunner.execute
        .mockResolvedValueOnce(ok({ stepName: 'step1', output: { data: 'ok' }, durationMs: 5 }))
        .mockResolvedValueOnce(
          fail({
            type: 'BUSINESS_ERROR',
            step: 'step2',
            cause: new Error('order rejected'),
            code: 'ORDER_REJECTED',
          }),
        );

      compensationRunner.run.mockResolvedValue(ok(undefined));

      const definition = createDefinition({
        steps: [step1, step2],
      });

      const state = createState({
        status: SagaStatus.PENDING,
        steps: [
          { name: 'step1', status: StepStatus.PENDING, attempt: 0 },
          { name: 'step2', status: StepStatus.PENDING, attempt: 0 },
        ],
      });

      const instance = new SagaInstance(
        definition,
        state,
        store,
        lockProvider,
        eventBus,
        stepRunner,
        compensationRunner,
      );

      const result = await instance.start();

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.status).toBe(SagaStatus.FAILED);
      }

      // Compensation should be called
      expect(compensationRunner.run).toHaveBeenCalled();

      // Final event should be SAGA_FAILED
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'SAGA_FAILED' }),
      );
    });

    it('should return PARTIALLY_COMPENSATED when compensation fails', async () => {
      const step1 = {
        name: 'step1',
        execute: vi.fn().mockResolvedValue(ok({ data: 'ok' })),
        compensate: vi.fn().mockResolvedValue(ok(undefined)),
      };

      stepRunner.execute.mockResolvedValue(
        fail({
          type: 'BUSINESS_ERROR',
          step: 'step1',
          cause: new Error('fail'),
          code: 'ERR',
        }),
      );

      compensationRunner.run.mockResolvedValue(
        fail({ category: 'COMPENSATION_ERROR', step: 'step1', cause: new Error('comp failed') }),
      );

      const definition = createDefinition({ steps: [step1] });
      const state = createState({
        status: SagaStatus.PENDING,
        steps: [{ name: 'step1', status: StepStatus.PENDING, attempt: 0 }],
      });

      const instance = new SagaInstance(
        definition,
        state,
        store,
        lockProvider,
        eventBus,
        stepRunner,
        compensationRunner,
      );

      const result = await instance.start();

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.status).toBe(SagaStatus.PARTIALLY_COMPENSATED);
      }
    });

    it('should call onComplete handler when all steps succeed', async () => {
      const onComplete = vi.fn().mockResolvedValue(undefined);

      stepRunner.execute.mockResolvedValue(ok({ stepName: 'step1', output: { done: true }, durationMs: 5 }));

      const definition = createDefinition({
        steps: [{ name: 'step1', execute: vi.fn() }],
        onComplete,
      });

      const state = createState({
        status: SagaStatus.PENDING,
        steps: [{ name: 'step1', status: StepStatus.PENDING, attempt: 0 }],
      });

      const instance = new SagaInstance(
        definition,
        state,
        store,
        lockProvider,
        eventBus,
        stepRunner,
        compensationRunner,
      );

      await instance.start();

      expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it('should call onFail handler when saga fails', async () => {
      const onFail = vi.fn().mockResolvedValue(undefined);

      stepRunner.execute.mockResolvedValue(
        fail({
          type: 'BUSINESS_ERROR',
          step: 'step1',
          cause: new Error('fail'),
          code: 'ERR',
        }),
      );

      const definition = createDefinition({
        steps: [{ name: 'step1', execute: vi.fn() }],
        onFail,
      });

      const state = createState({
        status: SagaStatus.PENDING,
        steps: [{ name: 'step1', status: StepStatus.PENDING, attempt: 0 }],
      });

      const instance = new SagaInstance(
        definition,
        state,
        store,
        lockProvider,
        eventBus,
        stepRunner,
        compensationRunner,
      );

      await instance.start();

      expect(onFail).toHaveBeenCalledTimes(1);
    });
  });

  describe('pause', () => {
    it('should transition RUNNING -> PAUSED', async () => {
      const state = createState({ status: SagaStatus.RUNNING });
      const instance = new SagaInstance(
        createDefinition(),
        state,
        store,
        lockProvider,
        eventBus,
        stepRunner,
        compensationRunner,
      );

      const result = await instance.pause();

      expect(isOk(result)).toBe(true);
      expect(instance.getState().status).toBe(SagaStatus.PAUSED);
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'SAGA_PAUSED' }),
      );
    });

    it('should fail when not in RUNNING state', async () => {
      const state = createState({ status: SagaStatus.PENDING });
      const instance = new SagaInstance(
        createDefinition(),
        state,
        store,
        lockProvider,
        eventBus,
        stepRunner,
        compensationRunner,
      );

      const result = await instance.pause();

      expect(isFail(result)).toBe(true);
      if (isFail(result)) {
        expect((result.error as any).category).toBe('INVALID_TRANSITION');
      }
    });
  });

  describe('resume', () => {
    it('should transition PAUSED -> RUNNING and execute remaining steps', async () => {
      stepRunner.execute.mockResolvedValue(ok({ stepName: 'step2', output: { done: true }, durationMs: 5 }));

      const definition = createDefinition({
        steps: [
          { name: 'step1', execute: vi.fn() },
          { name: 'step2', execute: vi.fn() },
        ],
      });

      const state = createState({
        status: SagaStatus.PAUSED,
        currentStepIndex: 1, // step1 already done
        steps: [
          { name: 'step1', status: StepStatus.SUCCEEDED, attempt: 1, output: { ok: true } },
          { name: 'step2', status: StepStatus.PENDING, attempt: 0 },
        ],
      });

      const instance = new SagaInstance(
        definition,
        state,
        store,
        lockProvider,
        eventBus,
        stepRunner,
        compensationRunner,
      );

      const result = await instance.resume();

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.status).toBe(SagaStatus.COMPLETED);
      }
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'SAGA_RESUMED' }),
      );
    });

    it('should fail when not in PAUSED state', async () => {
      const state = createState({ status: SagaStatus.RUNNING });
      const instance = new SagaInstance(
        createDefinition(),
        state,
        store,
        lockProvider,
        eventBus,
        stepRunner,
        compensationRunner,
      );

      const result = await instance.resume();

      expect(isFail(result)).toBe(true);
    });
  });
});
