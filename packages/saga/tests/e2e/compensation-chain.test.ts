// ---------------------------------------------------------------------------
// @backendkit-labs/saga -- tests/e2e/compensation-chain.test.ts
//
// E2E: tests compensation runner behavior directly.
// Note: StepRunner wraps step results (including fail()) in ok(StepResult),
// so compensation is triggered by exceptions, not Result failures.
// We test compensation logic via CompensationRunner directly.
// ---------------------------------------------------------------------------

import { ok, fail } from '@backendkit-labs/result';
import { CompensationRunner } from '../../src/core/compensation-runner';
import type { SagaState, SagaId } from '../../src/types/saga.types';
import { SagaStatus, StepStatus } from '../../src/types/saga.types';
import type { StepDefinition } from '../../src/types/step.types';

describe('Compensation Chain E2E', () => {
  function createState(overrides?: Partial<SagaState>): SagaState {
    return {
      id: 'e2e-saga-1' as SagaId,
      sagaType: 'e2e-comp-test',
      status: SagaStatus.COMPENSATING,
      correlationId: 'corr-e2e',
      steps: [
        { name: 'step-1', status: StepStatus.SUCCEEDED, attempt: 1, output: { step: 1 } },
        { name: 'step-2', status: StepStatus.SUCCEEDED, attempt: 1, output: { step: 2 } },
        { name: 'step-3', status: StepStatus.SUCCEEDED, attempt: 1, output: { step: 3 } },
      ],
      currentStepIndex: 0,
      createdAt: 1000,
      updatedAt: 1000,
      metadata: {},
      version: 3,
      ...overrides,
    };
  }

  it('should run compensation in reverse order', async () => {
    const order: string[] = [];
    const steps: StepDefinition[] = [
      { name: 'step-1', execute: async () => ok({} as any), compensate: async () => { order.push('step-1'); return ok(undefined); } },
      { name: 'step-2', execute: async () => ok({} as any), compensate: async () => { order.push('step-2'); return ok(undefined); } },
      { name: 'step-3', execute: async () => ok({} as any), compensate: async () => { order.push('step-3'); return ok(undefined); } },
    ];

    const state = createState();
    const runner = new CompensationRunner();
    const result = await runner.run(steps, state);

    expect(result.ok).toBe(true);
    // Reverse order: step-3 first, then step-2, then step-1
    expect(order).toEqual(['step-3', 'step-2', 'step-1']);
  });

  it('should call compensation for succeeded steps only', async () => {
    const compensate1 = vi.fn().mockResolvedValue(ok(undefined));
    const compensate2 = vi.fn().mockResolvedValue(ok(undefined));

    const steps: StepDefinition[] = [
      { name: 'step-1', execute: async () => ok({} as any), compensate: compensate1 },
      { name: 'step-2', execute: async () => ok({} as any), compensate: compensate2 },
    ];

    const state = createState({
      steps: [
        { name: 'step-1', status: StepStatus.SUCCEEDED, attempt: 1, output: { step: 1 } },
        { name: 'step-2', status: StepStatus.FAILED, attempt: 1, error: { type: 'BUSINESS_ERROR', step: 'step-2', cause: new Error('fail'), code: 'E' } },
      ],
    });

    const runner = new CompensationRunner();
    const result = await runner.run(steps, state);

    expect(result.ok).toBe(true);
    // Only step-1 was succeeded, so only step-1 gets compensated
    expect(compensate1).toHaveBeenCalledTimes(1);
    expect(compensate2).not.toHaveBeenCalled();
  });

  it('should report failure when a compensation handler fails', async () => {
    const steps: StepDefinition[] = [
      {
        name: 'step-1',
        execute: async () => ok({} as any),
        compensate: async () => fail({ category: 'COMPENSATION_ERROR', step: 'step-1', cause: new Error('Compensation failed') }),
      },
    ];

    const state = createState({
      steps: [{ name: 'step-1', status: StepStatus.SUCCEEDED, attempt: 1, output: {} }],
    });

    const runner = new CompensationRunner();
    const result = await runner.run(steps, state);

    expect(result.ok).toBe(false);
  });

  it('should pass correct context to compensation handler', async () => {
    const compensateMock = vi.fn().mockResolvedValue(ok(undefined));

    const steps: StepDefinition[] = [
      { name: 'step-1', execute: async () => ok({} as any), compensate: compensateMock },
    ];

    const state = createState({
      steps: [
        { name: 'step-1', status: StepStatus.SUCCEEDED, attempt: 1, output: { processed: true }, input: { orderId: 1 } },
      ],
    });

    const runner = new CompensationRunner();
    await runner.run(steps, state);

    expect(compensateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        stepName: 'step-1',
        originalInput: { orderId: 1 },
        originalOutput: { processed: true },
      }),
    );
  });

  it('should skip steps without compensation handler', async () => {
    const steps: StepDefinition[] = [
      { name: 'step-1', execute: async () => ok({} as any) }, // no compensate
      { name: 'step-2', execute: async () => ok({} as any), compensate: async () => ok(undefined) },
    ];

    const state = createState({
      steps: [
        { name: 'step-1', status: StepStatus.SUCCEEDED, attempt: 1 },
        { name: 'step-2', status: StepStatus.SUCCEEDED, attempt: 1 },
      ],
    });

    const runner = new CompensationRunner();
    const result = await runner.run(steps, state);

    expect(result.ok).toBe(true);
  });
});
