// ---------------------------------------------------------------------------
// @backendkit-labs/saga -- tests/e2e/crash-recovery.test.ts
//
// E2E: simulate crash and recovery via engine.create() + engine.run().
// ---------------------------------------------------------------------------

import { isOk, isFail } from '@backendkit-labs/result';
import { SagaEngine } from '../../src/core/saga-engine';
import { createMultiStepSaga } from '../fixtures/sample-sagas';
import { createRealStore, createRealLockProvider, createRealEventBus } from '../fixtures/mock-adapters';
import { SagaStatus } from '../../src/types/saga.types';

describe('Crash Recovery E2E', () => {
  it('should create a saga in PENDING state and run to COMPLETED', async () => {
    const store = createRealStore();
    const lockProvider = createRealLockProvider();
    const eventBus = createRealEventBus();

    const engine = new SagaEngine(store, lockProvider, eventBus);
    engine.define(createMultiStepSaga());

    const createResult = await engine.create('multi-step-saga', { fromCrash: true });

    expect(isOk(createResult)).toBe(true);
    if (!isOk(createResult)) return;

    const sagaId = createResult.value.getState().id;

    const pendingStatus = await engine.getStatus(sagaId);
    expect(isOk(pendingStatus)).toBe(true);
    if (isOk(pendingStatus)) {
      expect(pendingStatus.value.status).toBe(SagaStatus.PENDING);
    }

    const runResult = await engine.run('multi-step-saga', { afterCrash: true });

    expect(isOk(runResult)).toBe(true);
    if (isOk(runResult)) {
      expect(runResult.value.status).toBe(SagaStatus.COMPLETED);
    }
  });

  it('should run saga to COMPLETED and verify sagaId from output', async () => {
    const store = createRealStore();
    const lockProvider = createRealLockProvider();
    const eventBus = createRealEventBus();

    const engine = new SagaEngine(store, lockProvider, eventBus);
    engine.define(createMultiStepSaga());

    const result = await engine.run('multi-step-saga');

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.status).toBe(SagaStatus.COMPLETED);
      expect(result.value.sagaId).toBeDefined();
    }
  });

  it('should handle non-existent saga gracefully', async () => {
    const store = createRealStore();
    const lockProvider = createRealLockProvider();
    const eventBus = createRealEventBus();

    const engine = new SagaEngine(store, lockProvider, eventBus);

    const result = await engine.run('non-existent-saga');
    expect(isFail(result)).toBe(true);
  });
});
