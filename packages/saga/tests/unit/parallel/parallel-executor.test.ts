import { ok, isOk, isFail } from '@backendkit-labs/result';
import { ParallelExecutor } from '../../../src/parallel/parallel-executor';
import type { StepDefinition, StepContext } from '../../../src/types/step.types';

function createContext(overrides?: Partial<StepContext>): StepContext {
  return {
    sagaId: 'saga-1' as any,
    correlationId: 'corr-1',
    stepName: 'parallel-group',
    attempt: 1,
    input: {},
    previousOutput: undefined,
    metadata: {},
    ...overrides,
  };
}

describe('ParallelExecutor', () => {
  let executor: ParallelExecutor;

  beforeEach(() => {
    executor = new ParallelExecutor();
  });

  it('should return empty result for empty steps array', async () => {
    const result = await executor.execute([], createContext());

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toEqual([]);
    }
  });

  it('should execute all steps and collect results', async () => {
    const step1: StepDefinition = {
      name: 'step1',
      execute: vi.fn().mockResolvedValue(ok({ data: 'a' })),
    };
    const step2: StepDefinition = {
      name: 'step2',
      execute: vi.fn().mockResolvedValue(ok({ data: 'b' })),
    };

    const result = await executor.execute([step1, step2], createContext());

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toHaveLength(2);
      expect(result.value[0].stepName).toBe('step1');
      expect(result.value[1].stepName).toBe('step2');
    }
  });

  it('should handle steps that return fail as output (StepRunner wraps them)', async () => {
    // StepRunner doesn't inspect the Result -- it wraps the return value as output.
    const step1: StepDefinition = {
      name: 'step1',
      execute: vi.fn().mockResolvedValue(ok({ done: true })),
    };
    const step2: StepDefinition = {
      name: 'step2',
      execute: vi.fn().mockResolvedValue(ok({ error: 'business-error' })),
    };

    const result = await executor.execute([step1, step2], createContext());

    // Both steps "succeed" from StepRunner's perspective (no exception thrown)
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toHaveLength(2);
    }
  });

  it('should handle thrown errors as INFRASTRUCTURE_ERROR', async () => {
    const step1: StepDefinition = {
      name: 'step1',
      execute: vi.fn().mockRejectedValue(new Error('unexpected')),
    };

    const result = await executor.execute([step1], createContext());

    expect(isFail(result)).toBe(true);
    if (isFail(result)) {
      expect((result.error as any).type).toBe('INFRASTRUCTURE_ERROR');
      expect((result.error as any).code).toBe('STEP_EXECUTION_FAILED');
    }
  });

  it('should handle non-Error thrown values', async () => {
    const step1: StepDefinition = {
      name: 'step1',
      execute: vi.fn().mockRejectedValue('string error'),
    };

    const result = await executor.execute([step1], createContext());

    expect(isFail(result)).toBe(true);
    if (isFail(result)) {
      expect((result.error as any).cause).toBeInstanceOf(Error);
    }
  });

  it('should return first error when multiple steps throw', async () => {
    const step1: StepDefinition = {
      name: 'step1',
      execute: vi.fn().mockRejectedValue(new Error('err1')),
    };
    const step2: StepDefinition = {
      name: 'step2',
      execute: vi.fn().mockRejectedValue(new Error('err2')),
    };

    const result = await executor.execute([step1, step2], createContext());

    expect(isFail(result)).toBe(true);
    if (isFail(result)) {
      expect((result.error as any).type).toBe('INFRASTRUCTURE_ERROR');
    }
  });
});
