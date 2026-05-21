import { ok, fail, isOk, isFail } from '@backendkit-labs/result';
import { CompensationRunner } from '../../../src/core/compensation-runner';
import { SagaStatus, StepStatus } from '../../../src/types/saga.types';
import type { StepDefinition, CompensationHandler, CompensationContext } from '../../../src/types/step.types';
import type { SagaState } from '../../../src/types/saga.types';

function createState(overrides?: Partial<SagaState>): SagaState {
  return {
    id: 'saga-1' as any,
    sagaType: 'test',
    status: SagaStatus.COMPENSATING,
    correlationId: 'corr-1',
    steps: [],
    currentStepIndex: 1,
    createdAt: 1000,
    updatedAt: 1000,
    metadata: {},
    version: 3,
    ...overrides,
  };
}

describe('CompensationRunner', () => {
  let runner: CompensationRunner;

  beforeEach(() => {
    runner = new CompensationRunner();
  });

  it('should execute compensations in reverse order', async () => {
    const order: string[] = [];

    const compensate1: CompensationHandler = async () => {
      order.push('step1');
      return ok(undefined);
    };
    const compensate2: CompensationHandler = async () => {
      order.push('step2');
      return ok(undefined);
    };

    const step1: StepDefinition = { name: 'step1', execute: vi.fn(), compensate: compensate1 };
    const step2: StepDefinition = { name: 'step2', execute: vi.fn(), compensate: compensate2 };

    const state = createState({
      steps: [
        { name: 'step1', status: StepStatus.SUCCEEDED, attempt: 1, input: { a: 1 }, output: { x: 1 } },
        { name: 'step2', status: StepStatus.SUCCEEDED, attempt: 1, input: { a: 2 }, output: { x: 2 } },
      ],
    });

    const result = await runner.run([step1, step2], state);
    expect(isOk(result)).toBe(true);
    expect(order).toEqual(['step2', 'step1']);
  });

  it('should return Ok when all compensations succeed', async () => {
    const compensate: CompensationHandler = async () => ok(undefined);
    const step: StepDefinition = { name: 'step1', execute: vi.fn(), compensate };

    const state = createState({
      steps: [{ name: 'step1', status: StepStatus.SUCCEEDED, attempt: 1 }],
    });

    const result = await runner.run([step], state);
    expect(isOk(result)).toBe(true);
  });

  it('should return Fail when any compensation fails', async () => {
    const compensate1: CompensationHandler = async () => ok(undefined);
    const compensate2: CompensationHandler = async () => fail({ category: 'COMPENSATION_ERROR', step: 'step2', cause: new Error('refund failed') });

    const step1: StepDefinition = { name: 'step1', execute: vi.fn(), compensate: compensate1 };
    const step2: StepDefinition = { name: 'step2', execute: vi.fn(), compensate: compensate2 };

    const state = createState({
      steps: [
        { name: 'step1', status: StepStatus.SUCCEEDED, attempt: 1 },
        { name: 'step2', status: StepStatus.SUCCEEDED, attempt: 1 },
      ],
    });

    const result = await runner.run([step1, step2], state);
    expect(isFail(result)).toBe(true);
    if (isFail(result)) {
      expect((result.error as any).category).toBe('COMPENSATION_ERROR');
    }
  });

  it('should continue compensating other steps even if one fails', async () => {
    const order: string[] = [];

    const compensate1: CompensationHandler = async () => {
      order.push('step1');
      return ok(undefined);
    };
    const compensate2: CompensationHandler = async () => {
      order.push('step2');
      return fail({ category: 'COMPENSATION_ERROR', step: 'step2', cause: new Error('fail') });
    };
    const compensate3: CompensationHandler = async () => {
      order.push('step3');
      return ok(undefined);
    };

    const step1: StepDefinition = { name: 'step1', execute: vi.fn(), compensate: compensate1 };
    const step2: StepDefinition = { name: 'step2', execute: vi.fn(), compensate: compensate2 };
    const step3: StepDefinition = { name: 'step3', execute: vi.fn(), compensate: compensate3 };

    const state = createState({
      steps: [
        { name: 'step1', status: StepStatus.SUCCEEDED, attempt: 1 },
        { name: 'step2', status: StepStatus.SUCCEEDED, attempt: 1 },
        { name: 'step3', status: StepStatus.SUCCEEDED, attempt: 1 },
      ],
    });

    const result = await runner.run([step1, step2, step3], state);
    expect(isFail(result)).toBe(true);
    // Should have tried all compensations in reverse order
    expect(order).toEqual(['step3', 'step2', 'step1']);
  });

  it('should skip steps without compensation handler', async () => {
    const compensate: CompensationHandler = async () => ok(undefined);
    const step1: StepDefinition = { name: 'step1', execute: vi.fn(), compensate };
    const step2: StepDefinition = { name: 'step2', execute: vi.fn() }; // no compensate
    const step3: StepDefinition = { name: 'step3', execute: vi.fn(), compensate };

    const state = createState({
      steps: [
        { name: 'step1', status: StepStatus.SUCCEEDED, attempt: 1 },
        { name: 'step2', status: StepStatus.SUCCEEDED, attempt: 1 },
        { name: 'step3', status: StepStatus.SUCCEEDED, attempt: 1 },
      ],
    });

    const result = await runner.run([step1, step2, step3], state);
    expect(isOk(result)).toBe(true);
  });

  it('should skip steps without a name', async () => {
    const compensate: CompensationHandler = async () => ok(undefined);
    const step: StepDefinition = { name: 'step1', execute: vi.fn(), compensate };

    const state = createState({
      steps: [
        { name: undefined as any, status: StepStatus.SUCCEEDED, attempt: 1 },
      ],
    });

    const result = await runner.run([step], state);
    expect(isOk(result)).toBe(true);
  });

  it('should skip steps that are not SUCCEEDED', async () => {
    const log: string[] = [];
    const compensate: CompensationHandler = async () => {
      log.push('compensated');
      return ok(undefined);
    };

    const step: StepDefinition = { name: 'step1', execute: vi.fn(), compensate };

    const state = createState({
      steps: [
        { name: 'step1', status: StepStatus.FAILED, attempt: 1 },
      ],
    });

    const result = await runner.run([step], state);
    expect(isOk(result)).toBe(true);
    expect(log).toEqual([]);
  });

  it('should catch synchronous throws in compensate handler', async () => {
    const compensate: CompensationHandler = async () => {
      throw new Error('unexpected error');
    };

    const step: StepDefinition = { name: 'step1', execute: vi.fn(), compensate };

    const state = createState({
      steps: [{ name: 'step1', status: StepStatus.SUCCEEDED, attempt: 1 }],
    });

    const result = await runner.run([step], state);
    expect(isFail(result)).toBe(true);
  });

  it('should pass correct compensation context to handler', async () => {
    const captured: CompensationContext[] = [];

    const compensate: CompensationHandler = async (ctx: CompensationContext) => {
      captured.push(ctx);
      return ok(undefined);
    };

    const step: StepDefinition = { name: 'the-step', execute: vi.fn(), compensate };

    const state = createState({
      steps: [{
        name: 'the-step',
        status: StepStatus.SUCCEEDED,
        attempt: 1,
        input: { orderId: 42 },
        output: { success: true },
        error: { category: 'SAGA_INTERNAL', cause: new Error('step failed') },
      }],
    });

    await runner.run([step], state);

    expect(captured).toHaveLength(1);
    expect(captured[0].stepName).toBe('the-step');
    expect(captured[0].originalInput).toEqual({ orderId: 42 });
    expect(captured[0].originalOutput).toEqual({ success: true });
    expect(captured[0].sagaId).toBe('saga-1');
  });

  it('should return Ok when no steps have compensations', async () => {
    const step1: StepDefinition = { name: 'step1', execute: vi.fn() };
    const step2: StepDefinition = { name: 'step2', execute: vi.fn() };

    const state = createState({
      steps: [
        { name: 'step1', status: StepStatus.SUCCEEDED, attempt: 1 },
        { name: 'step2', status: StepStatus.SUCCEEDED, attempt: 1 },
      ],
    });

    const result = await runner.run([step1, step2], state);
    expect(isOk(result)).toBe(true);
  });

  it('should return Ok when no steps succeeded', async () => {
    const compensate: CompensationHandler = async () => ok(undefined);
    const step: StepDefinition = { name: 'step1', execute: vi.fn(), compensate };

    const state = createState({
      steps: [{ name: 'step1', status: StepStatus.PENDING, attempt: 0 }],
    });

    const result = await runner.run([step], state);
    expect(isOk(result)).toBe(true);
  });
});
