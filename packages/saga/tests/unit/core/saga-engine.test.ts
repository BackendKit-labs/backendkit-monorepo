import { ok, fail, isOk, isFail } from '@backendkit-labs/result';
import { SagaEngine } from '../../../src/core/saga-engine';
import { SagaBuilder } from '../../../src/core/saga-builder';
import { SagaStatus, StepStatus } from '../../../src/types/saga.types';
import type { SagaStore } from '../../../src/persistence/saga-store.interface';
import type { LockProvider } from '../../../src/types/lock.types';
import type { SagaEventBus } from '../../../src/types/events.types';

vi.mock('../../../src/utils/time', () => ({
  currentTimestamp: vi.fn(() => 1000),
  createTimer: vi.fn(() => ({
    promise: new Promise<void>(() => {}),
    cancel: vi.fn(),
  })),
}));

let sagaIdCounter = 0;
vi.mock('../../../src/utils/id-generator', () => ({
  generateSagaId: vi.fn(() => {
    sagaIdCounter++;
    return `saga-id-${sagaIdCounter}` as any;
  }),
  generateCorrelationId: vi.fn(() => 'corr-id-mock'),
  generateEventId: vi.fn(() => 'evt-id-mock'),
}));

function createMockStore(): Mocked<SagaStore> {
  return {
    save: vi.fn().mockResolvedValue(ok(undefined)),
    load: vi.fn().mockResolvedValue(
      ok({
        id: 'saga-1' as any,
        sagaType: 'test-saga',
        status: SagaStatus.PAUSED,
        correlationId: 'corr-1',
        steps: [{ name: 'step1', status: StepStatus.SUCCEEDED, attempt: 1 }],
        currentStepIndex: 1,
        createdAt: 1000,
        updatedAt: 1000,
        metadata: {},
        version: 2,
      } as any),
    ),
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

describe('SagaEngine', () => {
  let store: Mocked<SagaStore>;
  let lockProvider: Mocked<LockProvider>;
  let eventBus: Mocked<SagaEventBus>;

  beforeEach(() => {
    sagaIdCounter = 0;
    store = createMockStore();
    lockProvider = createMockLockProvider();
    eventBus = createMockEventBus();
  });

  describe('define', () => {
    it('should register a saga definition from a builder', () => {
      const engine = new SagaEngine(store, lockProvider, eventBus);
      const builder = SagaBuilder.define('order-flow').step({
        name: 'step1',
        execute: vi.fn(),
      });

      const definition = engine.define(builder);

      expect(definition.name).toBe('order-flow');
      expect(definition.steps).toHaveLength(1);
    });

    it('should store definition for later use', async () => {
      const engine = new SagaEngine(store, lockProvider, eventBus);
      engine.define(
        SagaBuilder.define('my-saga').step({ name: 's1', execute: vi.fn() }),
      );

      const result = await engine.run('my-saga');
      expect(isOk(result)).toBe(true);
    });
  });

  describe('create', () => {
    it('should create a new saga instance with PENDING status', async () => {
      const engine = new SagaEngine(store, lockProvider, eventBus);
      engine.define(
        SagaBuilder.define('test-saga').step({ name: 's1', execute: vi.fn() }),
      );

      const result = await engine.create('test-saga', { orderId: 42 });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const instance = result.value;
        const state = instance.getState();
        expect(state.status).toBe(SagaStatus.PENDING);
        expect(state.sagaType).toBe('test-saga');
        expect(state.steps).toHaveLength(1);
        expect(state.steps[0].status).toBe(StepStatus.PENDING);
        expect(state.steps[0].input).toEqual({ orderId: 42 });
        expect(state.version).toBe(1);
      }
    });

    it('should persist initial state to store', async () => {
      const engine = new SagaEngine(store, lockProvider, eventBus);
      engine.define(
        SagaBuilder.define('test-saga').step({ name: 's1', execute: vi.fn() }),
      );

      await engine.create('test-saga');

      expect(store.save).toHaveBeenCalledTimes(1);
      const savedState = store.save.mock.calls[0][0];
      expect(savedState.status).toBe(SagaStatus.PENDING);
      expect(savedState.version).toBe(1);
    });

    it('should return SAGA_NOT_FOUND for undefined saga type', async () => {
      const engine = new SagaEngine(store, lockProvider, eventBus);

      const result = await engine.create('non-existent');

      expect(isFail(result)).toBe(true);
      if (isFail(result)) {
        expect((result.error as any).category).toBe('SAGA_NOT_FOUND');
      }
    });

    it('should propagate store save failure', async () => {
      store.save.mockResolvedValue(
        fail({ category: 'PERSISTENCE_ERROR', cause: new Error('DB down') } as any),
      );

      const engine = new SagaEngine(store, lockProvider, eventBus);
      engine.define(
        SagaBuilder.define('test-saga').step({ name: 's1', execute: vi.fn() }),
      );

      const result = await engine.create('test-saga');

      expect(isFail(result)).toBe(true);
    });

    it('should handle parallel steps in initial state', async () => {
      const engine = new SagaEngine(store, lockProvider, eventBus);
      engine.define(
        SagaBuilder.define('parallel-saga')
          .step({ name: 'before', execute: vi.fn() })
          .parallel(
            { name: 'p1', execute: vi.fn() },
            { name: 'p2', execute: vi.fn() },
          ),
      );

      const result = await engine.create('parallel-saga');
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const state = result.value.getState();
        // Parallel group is stored as a single step with label "parallel(p1,p2)"
        expect(state.steps).toHaveLength(2);
        expect(state.steps[0].name).toBe('before');
        expect(state.steps[1].name).toBe('parallel(p1,p2)');
      }
    });
  });

  describe('run', () => {
    it('should create and start a saga', async () => {
      const engine = new SagaEngine(store, lockProvider, eventBus);
      engine.define(
        SagaBuilder.define('quick-saga').step({
          name: 's1',
          execute: vi.fn().mockResolvedValue(ok({ done: true })),
        }),
      );

      const result = await engine.run('quick-saga', { input: 'data' });

      expect(isOk(result)).toBe(true);
    });

    it('should propagate create failure', async () => {
      const engine = new SagaEngine(store, lockProvider, eventBus);

      const result = await engine.run('non-existent');

      expect(isFail(result)).toBe(true);
    });
  });

  describe('getStatus', () => {
    it('should load saga state from store', async () => {
      const engine = new SagaEngine(store, lockProvider, eventBus);

      const result = await engine.getStatus('saga-1' as any);

      expect(isOk(result)).toBe(true);
      expect(store.load).toHaveBeenCalledWith('saga-1');
    });
  });

  describe('list', () => {
    it('should list sagas from store', async () => {
      const engine = new SagaEngine(store, lockProvider, eventBus);

      const result = await engine.list();

      expect(isOk(result)).toBe(true);
      expect(store.list).toHaveBeenCalledWith(undefined);
    });

    it('should pass filter to store', async () => {
      const engine = new SagaEngine(store, lockProvider, eventBus);

      const filter = { status: SagaStatus.RUNNING };
      await engine.list(filter);

      expect(store.list).toHaveBeenCalledWith(filter);
    });
  });

  describe('pause', () => {
    it('should pause a saga end-to-end', async () => {
      const engine = new SagaEngine(store, lockProvider, eventBus);
      engine.define(
        SagaBuilder.define('test-saga').step({ name: 's1', execute: vi.fn() }),
      );

      // First create a saga
      const createResult = await engine.create('test-saga');
      expect(isOk(createResult)).toBe(true);

      // Override load to return a RUNNING saga
      store.load.mockResolvedValue(
        ok({
          id: 'saga-1' as any,
          sagaType: 'test-saga',
          status: SagaStatus.RUNNING,
          correlationId: 'corr-1',
          steps: [{ name: 's1', status: StepStatus.PENDING, attempt: 0 }],
          currentStepIndex: 0,
          createdAt: 1000,
          updatedAt: 1000,
          metadata: {},
          version: 2,
        } as any),
      );

      const result = await engine.pause('saga-1' as any);
      expect(isOk(result)).toBe(true);
    });

    it('should return error for non-existent saga', async () => {
      store.load.mockResolvedValue(
        fail({ category: 'SAGA_NOT_FOUND', sagaId: 'bad-id' as any } as any),
      );

      const engine = new SagaEngine(store, lockProvider, eventBus);

      const result = await engine.pause('bad-id' as any);
      expect(isFail(result)).toBe(true);
      if (isFail(result)) {
        expect((result.error as any).category).toBe('SAGA_NOT_FOUND');
      }
    });

    it('should return error for undefined saga type', async () => {
      store.load.mockResolvedValue(
        ok({
          id: 'saga-1' as any,
          sagaType: 'unknown-type',
          status: SagaStatus.RUNNING,
          correlationId: 'corr-1',
          steps: [],
          currentStepIndex: 0,
          createdAt: 1000,
          updatedAt: 1000,
          metadata: {},
          version: 2,
        } as any),
      );

      const engine = new SagaEngine(store, lockProvider, eventBus);

      const result = await engine.pause('saga-1' as any);
      expect(isFail(result)).toBe(true);
      if (isFail(result)) {
        expect((result.error as any).category).toBe('SAGA_NOT_FOUND');
      }
    });
  });

  describe('resume', () => {
    it('should load saga state and resume it', async () => {
      const engine = new SagaEngine(store, lockProvider, eventBus);
      engine.define(
        SagaBuilder.define('test-saga').step({ name: 's1', execute: vi.fn() }),
      );

      store.load.mockResolvedValue(
        ok({
          id: 'saga-id-1' as any,
          sagaType: 'test-saga',
          status: SagaStatus.PAUSED,
          correlationId: 'corr-1',
          steps: [{ name: 's1', status: StepStatus.PENDING, attempt: 0 }],
          currentStepIndex: 0,
          createdAt: 1000,
          updatedAt: 1000,
          metadata: {},
          version: 2,
        } as any),
      );

      const result = await engine.resume('saga-id-1' as any);
      expect(isOk(result)).toBe(true);
    });

    it('should return error for non-existent saga', async () => {
      store.load.mockResolvedValue(
        fail({ category: 'SAGA_NOT_FOUND', sagaId: 'bad-id' as any } as any),
      );

      const engine = new SagaEngine(store, lockProvider, eventBus);

      const result = await engine.resume('bad-id' as any);
      expect(isFail(result)).toBe(true);
    });
  });
});
