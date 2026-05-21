import { isOk, isFail } from '@backendkit-labs/result';
import { StepRunner } from '../../../src/core/step-runner';
import type { StepDefinition, StepContext } from '../../../src/types/step.types';

vi.mock('../../../src/utils/time', async () => {
  const original = await vi.importActual<typeof import('../../../src/utils/time')>('../../../src/utils/time');
  return {
    ...original,
    currentTimestamp: vi.fn(() => Date.now()),
  };
});

function createContext(overrides?: Partial<StepContext>): StepContext {
  return {
    sagaId: 'saga-1' as any,
    correlationId: 'corr-1',
    stepName: 'test-step',
    attempt: 1,
    input: { orderId: 123 },
    previousOutput: undefined,
    metadata: {},
    ...overrides,
  };
}

describe('StepRunner', () => {
  let runner: StepRunner;

  beforeEach(() => {
    runner = new StepRunner();
  });

  describe('execute', () => {
    it('should return Ok with step result on success', async () => {
      const handler = vi.fn().mockResolvedValue({ ok: true, value: 'done' });
      const step: StepDefinition = { name: 'test-step', execute: handler };

      const result = await runner.execute(step, createContext());

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.stepName).toBe('test-step');
        expect(result.value.output).toEqual({ ok: true, value: 'done' });
        expect(result.value.durationMs).toBeGreaterThanOrEqual(0);
      }
    });

    it('should call the step execute handler with context', async () => {
      const handler = vi.fn().mockResolvedValue({ ok: true, value: 'done' });
      const step: StepDefinition = { name: 'test-step', execute: handler };
      const ctx = createContext();

      await runner.execute(step, ctx);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(ctx);
    });

    it('should return INFRASTRUCTURE_ERROR when handler throws', async () => {
      const error = new Error('Connection refused');
      const handler = vi.fn().mockRejectedValue(error);
      const step: StepDefinition = { name: 'failing-step', execute: handler };

      const result = await runner.execute(step, createContext());

      expect(isFail(result)).toBe(true);
      if (isFail(result)) {
        expect((result.error as any).type).toBe('INFRASTRUCTURE_ERROR');
        expect((result.error as any).step).toBe('failing-step');
        expect((result.error as any).cause).toBe(error);
        expect((result.error as any).code).toBe('STEP_EXECUTION_FAILED');
      }
    });

    it('should wrap non-Error thrown values', async () => {
      const handler = vi.fn().mockRejectedValue('string error');
      const step: StepDefinition = { name: 'weird-step', execute: handler };

      const result = await runner.execute(step, createContext());

      expect(isFail(result)).toBe(true);
      if (isFail(result)) {
        expect((result.error as any).cause).toBeInstanceOf(Error);
        expect((result.error as any).cause.message).toBe('string error');
      }
    });

    it('should return STEP_TIMEOUT when step exceeds timeout', async () => {
      const handler = vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 200)),
      );
      const step: StepDefinition = {
        name: 'slow-step',
        execute: handler,
        timeoutMs: 5,
      };

      const result = await runner.execute(step, createContext());

      expect(isFail(result)).toBe(true);
      if (isFail(result)) {
        expect((result.error as any).type).toBe('STEP_TIMEOUT');
        expect((result.error as any).step).toBe('slow-step');
        expect((result.error as any).timeoutMs).toBe(5);
      }
    });

    it('should complete before timeout when step is fast enough', async () => {
      const handler = vi.fn().mockResolvedValue({ ok: true, value: 'fast' });
      const step: StepDefinition = {
        name: 'fast-step',
        execute: handler,
        timeoutMs: 5000,
      };

      const result = await runner.execute(step, createContext());

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.output).toEqual({ ok: true, value: 'fast' });
      }
    });

    it('should not apply timeout when timeoutMs is 0', async () => {
      const handler = vi.fn().mockResolvedValue({ ok: true, value: 'no-timeout' });
      const step: StepDefinition = {
        name: 'no-timeout-step',
        execute: handler,
        timeoutMs: 0,
      };

      const result = await runner.execute(step, createContext());
      expect(isOk(result)).toBe(true);
    });

    it('should not apply timeout when timeoutMs is undefined', async () => {
      const handler = vi.fn().mockResolvedValue({ ok: true, value: 'no-timeout' });
      const step: StepDefinition = { name: 'no-timeout-step', execute: handler };

      const result = await runner.execute(step, createContext());
      expect(isOk(result)).toBe(true);
    });

    it('should record duration accurately', async () => {
      const handler = vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 20)),
      );
      const step: StepDefinition = { name: 'timed-step', execute: handler };

      const result = await runner.execute(step, createContext());
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.durationMs).toBeGreaterThanOrEqual(15);
        expect(result.value.durationMs).toBeLessThan(500);
      }
    }, 10000);
  });
});
