// ---------------------------------------------------------------------------
// @backendkit-labs/saga -- tests/e2e/order-saga.test.ts
//
// E2E: Create saga via SagaEngine, execute sequential steps, verify COMPLETED.
// ---------------------------------------------------------------------------

import { isOk } from '@backendkit-labs/result';
import { SagaEngine } from '../../src/core/saga-engine';
import { createMultiStepSaga, createSimpleSaga } from '../fixtures/sample-sagas';
import { createRealStore, createRealLockProvider, createRealEventBus } from '../fixtures/mock-adapters';
import { SagaStatus } from '../../src/types/saga.types';

describe('Order Saga E2E', () => {
  it('should execute multi-step saga to COMPLETED via run()', async () => {
    const store = createRealStore();
    const lockProvider = createRealLockProvider();
    const eventBus = createRealEventBus();

    const engine = new SagaEngine(store, lockProvider, eventBus);
    const definition = engine.define(createMultiStepSaga());

    expect(definition.name).toBe('multi-step-saga');
    expect(definition.steps).toHaveLength(3);

    const result = await engine.run('multi-step-saga', { orderId: 42 });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.status).toBe(SagaStatus.COMPLETED);
      expect(result.value.sagaId).toBeDefined();
    }
  });

  it('should execute single-step saga to COMPLETED via run()', async () => {
    const store = createRealStore();
    const lockProvider = createRealLockProvider();
    const eventBus = createRealEventBus();

    const engine = new SagaEngine(store, lockProvider, eventBus);
    engine.define(createSimpleSaga());

    const result = await engine.run('simple-saga');

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.status).toBe(SagaStatus.COMPLETED);
    }
  });

  it('should return sagaId in run() output', async () => {
    const store = createRealStore();
    const lockProvider = createRealLockProvider();
    const eventBus = createRealEventBus();

    const engine = new SagaEngine(store, lockProvider, eventBus);
    engine.define(createMultiStepSaga());

    const result = await engine.run('multi-step-saga');
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.sagaId).toBeDefined();
      expect(typeof result.value.sagaId).toBe('string');
    }
  });

  it('should persist saga to store and be retrievable via getStatus', async () => {
    const store = createRealStore();
    const lockProvider = createRealLockProvider();
    const eventBus = createRealEventBus();

    const engine = new SagaEngine(store, lockProvider, eventBus);
    engine.define(createMultiStepSaga());

    const result = await engine.run('multi-step-saga');
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const sagaId = result.value.sagaId;

      // State should be loadable from store
      const stateResult = await engine.getStatus(sagaId);
      expect(isOk(stateResult)).toBe(true);
      if (isOk(stateResult)) {
        expect(stateResult.value.id).toBe(sagaId);
        expect(stateResult.value.steps.length).toBeGreaterThan(0);
      }
    }
  });

  it('should list sagas by sagaType', async () => {
    const store = createRealStore();
    const lockProvider = createRealLockProvider();
    const eventBus = createRealEventBus();

    const engine = new SagaEngine(store, lockProvider, eventBus);
    engine.define(createMultiStepSaga());

    await engine.run('multi-step-saga');

    const listResult = await engine.list({ sagaType: 'multi-step-saga' });
    expect(isOk(listResult)).toBe(true);
    if (isOk(listResult)) {
      expect(listResult.value.length).toBeGreaterThanOrEqual(1);
    }
  });
});
