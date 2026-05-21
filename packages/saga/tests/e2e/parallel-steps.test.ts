// ---------------------------------------------------------------------------
// @backendkit-labs/saga -- tests/e2e/parallel-steps.test.ts
//
// E2E: saga with parallel steps completes successfully.
// ---------------------------------------------------------------------------

import { ok, isOk } from '@backendkit-labs/result';
import { SagaEngine } from '../../src/core/saga-engine';
import { SagaBuilder } from '../../src/core/saga-builder';
import { createParallelSaga } from '../fixtures/sample-sagas';
import { createRealStore, createRealLockProvider, createRealEventBus } from '../fixtures/mock-adapters';
import { SagaStatus } from '../../src/types/saga.types';
import type { SagaResult } from '../../src/types/error.types';

describe('Parallel Steps E2E', () => {
  it('should execute parallel steps and complete', async () => {
    const store = createRealStore();
    const lockProvider = createRealLockProvider();
    const eventBus = createRealEventBus();

    const engine = new SagaEngine(store, lockProvider, eventBus);
    engine.define(createParallelSaga());

    const result = await engine.run('parallel-saga', { parallelId: 99 });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.status).toBe(SagaStatus.COMPLETED);
    }
  });

  it('should execute before first, parallel middle, after last', async () => {
    const store = createRealStore();
    const lockProvider = createRealLockProvider();
    const eventBus = createRealEventBus();

    const executionOrder: string[] = [];

    const engine = new SagaEngine(store, lockProvider, eventBus);
    engine.define(
      SagaBuilder.define('e2e-parallel-order')
        .step({
          name: 'before',
          execute: async (_ctx) => {
            executionOrder.push('before');
            return ok({ phase: 'before' }) as SagaResult<unknown>;
          },
        })
        .parallel(
          { name: 'p1', execute: async () => { executionOrder.push('p1'); return ok({ id: 'p1' }) as SagaResult<unknown>; } },
          { name: 'p2', execute: async () => { executionOrder.push('p2'); return ok({ id: 'p2' }) as SagaResult<unknown>; } },
          { name: 'p3', execute: async () => { executionOrder.push('p3'); return ok({ id: 'p3' }) as SagaResult<unknown>; } },
        )
        .step({
          name: 'after',
          execute: async (_ctx) => {
            executionOrder.push('after');
            return ok({ phase: 'after' }) as SagaResult<unknown>;
          },
        }),
    );

    const result = await engine.run('e2e-parallel-order');

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.status).toBe(SagaStatus.COMPLETED);
    }

    expect(executionOrder[0]).toBe('before');
    expect(executionOrder[executionOrder.length - 1]).toBe('after');
    expect(executionOrder).toContain('p1');
    expect(executionOrder).toContain('p2');
    expect(executionOrder).toContain('p3');
  });

  it('should publish events during parallel step execution', async () => {
    const store = createRealStore();
    const lockProvider = createRealLockProvider();
    const eventBus = createRealEventBus();

    const events: string[] = [];
    eventBus.subscribeAll((event) => {
      events.push(event.eventType);
    });

    const engine = new SagaEngine(store, lockProvider, eventBus);
    engine.define(createParallelSaga());

    await engine.run('parallel-saga');

    expect(events).toContain('SAGA_STARTED');
    expect(events).toContain('SAGA_COMPLETED');
    const stepSucceededCount = events.filter((e) => e === 'STEP_SUCCEEDED').length;
    expect(stepSucceededCount).toBeGreaterThanOrEqual(3);
  });
});
