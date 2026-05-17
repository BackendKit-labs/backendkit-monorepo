import { describe, expect, it, vi } from 'vitest';
import { pipeline, Ok, Err } from '../../src/index.js';
import type { PipelineStep, StepResult } from '../../src/index.js';

interface Ctx { value: number; log: string[] }
interface TestErr { code: string }

function makeStep(
  name: string,
  transform: (ctx: Ctx) => Ctx | null,
): PipelineStep<Ctx, TestErr> {
  return {
    stepName: name,
    async handle(ctx: Ctx): Promise<StepResult<Ctx, TestErr>> {
      const next = transform(ctx);
      return next === null ? Err({ code: `${name}_FAILED` }) : Ok(next);
    },
  };
}

const pass = (name: string) => makeStep(name, ctx => ({ ...ctx, log: [...ctx.log, name] }));
const fail = (name: string) => makeStep(name, () => null);
const init: Ctx = { value: 0, log: [] };

// ── stop-on-first (default) ───────────────────────────────────────────────────

describe('stop-on-first (default)', () => {
  it('returns Ok with final context when all steps succeed', async () => {
    const result = await pipeline<Ctx, TestErr>()
      .pipe(makeStep('A', ctx => ({ ...ctx, value: ctx.value + 1 })))
      .pipe(makeStep('B', ctx => ({ ...ctx, value: ctx.value * 2 })))
      .run({ value: 1, log: [] });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.value).toBe(4);           // (1+1)*2
    expect(result.executedSteps).toEqual(['A', 'B']);
  });

  it('stops at first failure and does not call subsequent steps', async () => {
    const cSpy = vi.fn();

    const result = await pipeline<Ctx, TestErr>()
      .pipe(pass('A'))
      .pipe(fail('B'))
      .pipe(makeStep('C', ctx => { cSpy(); return ctx; }))
      .run(init);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.failedStep).toBe('B');
    expect(result.error.cause).toEqual({ code: 'B_FAILED' });
    expect(result.error.executedSteps).toEqual(['A']);
    expect(result.error.failures).toHaveLength(1);
    expect(cSpy).not.toHaveBeenCalled();
  });

  it('reports mode in error', async () => {
    const result = await pipeline<Ctx, TestErr>().pipe(fail('A')).run(init);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.mode).toBe('stop-on-first');
  });
});

// ── collect-all ───────────────────────────────────────────────────────────────

describe('collect-all', () => {
  it('runs every step even after failures', async () => {
    const result = await pipeline<Ctx, TestErr>({ mode: 'collect-all' })
      .pipe(fail('A'))
      .pipe(pass('B'))
      .pipe(fail('C'))
      .run(init);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.failures).toHaveLength(2);
    expect(result.error.failures[0].step).toBe('A');
    expect(result.error.failures[1].step).toBe('C');
    expect(result.error.executedSteps).toContain('B');
  });

  it('returns Ok when all steps succeed', async () => {
    const result = await pipeline<Ctx, TestErr>({ mode: 'collect-all' })
      .pipe(pass('A'))
      .pipe(pass('B'))
      .run(init);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.executedSteps).toEqual(['A', 'B']);
  });

  it('reports mode in error', async () => {
    const result = await pipeline<Ctx, TestErr>({ mode: 'collect-all' })
      .pipe(fail('A'))
      .run(init);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.mode).toBe('collect-all');
  });
});

// ── pipeIf ────────────────────────────────────────────────────────────────────

describe('pipeIf', () => {
  it('skips step when condition is false', async () => {
    const result = await pipeline<Ctx, TestErr>()
      .pipe(pass('A'))
      .pipeIf(() => false, fail('B'))   // would fail if executed
      .run(init);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.executedSteps).toEqual(['A']);
  });

  it('runs step when condition is true', async () => {
    const result = await pipeline<Ctx, TestErr>()
      .pipe(pass('A'))
      .pipeIf(ctx => ctx.log.includes('A'), pass('B'))
      .run(init);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.executedSteps).toEqual(['A', 'B']);
  });

  it('receives current context in condition', async () => {
    const condition = vi.fn((ctx: Ctx) => ctx.value > 5);

    await pipeline<Ctx, TestErr>()
      .pipe(makeStep('A', ctx => ({ ...ctx, value: 10 })))
      .pipeIf(condition, pass('B'))
      .run(init);

    expect(condition).toHaveBeenCalledWith(expect.objectContaining({ value: 10 }));
  });
});

// ── hooks ─────────────────────────────────────────────────────────────────────

describe('hooks', () => {
  it('calls onStep before each executed step', async () => {
    const onStep = vi.fn();

    await pipeline<Ctx, TestErr>({ onStep })
      .pipe(pass('A'))
      .pipe(pass('B'))
      .run(init);

    expect(onStep).toHaveBeenCalledTimes(2);
    expect(onStep).toHaveBeenNthCalledWith(1, 'A', expect.any(Object));
    expect(onStep).toHaveBeenNthCalledWith(2, 'B', expect.any(Object));
  });

  it('calls onError with step name and error when a step fails', async () => {
    const onError = vi.fn();

    await pipeline<Ctx, TestErr>({ onError }).pipe(fail('A')).run(init);

    expect(onError).toHaveBeenCalledWith('A', { code: 'A_FAILED' });
  });

  it('calls onStepComplete after each successful step', async () => {
    const onStepComplete = vi.fn();

    await pipeline<Ctx, TestErr>({ onStepComplete })
      .pipe(pass('A'))
      .pipe(pass('B'))
      .run(init);

    expect(onStepComplete).toHaveBeenCalledTimes(2);
    expect(onStepComplete).toHaveBeenNthCalledWith(1, 'A', expect.any(Object), expect.any(Number));
  });

  it('calls onComplete when the pipeline succeeds', async () => {
    const onComplete = vi.fn();

    await pipeline<Ctx, TestErr>({ onComplete }).pipe(pass('A')).run(init);

    expect(onComplete).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Number),
      expect.objectContaining({
        executedSteps: ['A'],
        failures: [],
      }),
    );
  });

  it('does not call onComplete when the pipeline fails', async () => {
    const onComplete = vi.fn();

    await pipeline<Ctx, TestErr>({ onComplete }).pipe(fail('A')).run(init);

    expect(onComplete).not.toHaveBeenCalled();
  });

  it('does not propagate exceptions thrown by hooks', async () => {
    const result = await pipeline<Ctx, TestErr>({
      onStep:         () => { throw new Error('onStep exploded'); },
      onStepComplete: () => { throw new Error('onStepComplete exploded'); },
      onComplete:     () => { throw new Error('onComplete exploded'); },
    })
      .pipe(pass('A'))
      .run(init);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.executedSteps).toEqual(['A']);
  });

  it('does not propagate onError hook exceptions and still returns pipeline error', async () => {
    const result = await pipeline<Ctx, TestErr>({
      onError: () => { throw new Error('onError exploded'); },
    })
      .pipe(fail('A'))
      .run(init);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.failedStep).toBe('A');
  });
});

// ── context flow ──────────────────────────────────────────────────────────────

describe('context flow', () => {
  it('passes transformed context from one step to the next', async () => {
    const result = await pipeline<Ctx, TestErr>()
      .pipe(makeStep('A', ctx => ({ ...ctx, value: ctx.value + 10 })))
      .pipe(makeStep('B', ctx => ({ ...ctx, value: ctx.value * 3 })))
      .run({ value: 2, log: [] });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.value).toBe(36); // (2+10)*3
  });
});

// ── metadata ──────────────────────────────────────────────────────────────────

describe('result metadata', () => {
  it('includes durationMs >= 0 in success result', async () => {
    const result = await pipeline<Ctx, TestErr>().pipe(pass('A')).run(init);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('includes durationMs >= 0 in error result', async () => {
    const result = await pipeline<Ctx, TestErr>().pipe(fail('A')).run(init);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.durationMs).toBeGreaterThanOrEqual(0);
  });
});

// ── edge cases ────────────────────────────────────────────────────────────────

describe('edge cases', () => {
  it('empty pipeline returns Ok with the original context', async () => {
    const ctx = { value: 42, log: [] };
    const result = await pipeline<Ctx, TestErr>().run(ctx);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBe(ctx);
    expect(result.executedSteps).toHaveLength(0);
  });

  it('stepName property overrides constructor.name for reporting', async () => {
    const step: PipelineStep<Ctx, TestErr> = {
      stepName: 'MyCustomName',
      async handle() { return Err({ code: 'X' }); },
    };

    const result = await pipeline<Ctx, TestErr>().pipe(step).run(init);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.failedStep).toBe('MyCustomName');
  });
});

// ── mode validation (H-01) ────────────────────────────────────────────────────

describe('mode validation', () => {
  it('throws TypeError for invalid mode string', async () => {
    // @ts-expect-error — testing runtime guard for invalid mode
    const p = () => pipeline<Ctx, TestErr>({ mode: 'stop-all' }).pipe(pass('A')).run(init);
    await expect(p()).rejects.toThrow(TypeError);
    await expect(p()).rejects.toThrow(/Invalid pipeline mode/);
  });

  it('throws TypeError for non-string mode', async () => {
    // @ts-expect-error — testing runtime guard for non-string mode
    const p = () => pipeline<Ctx, TestErr>({ mode: 123 }).pipe(pass('A')).run(init);
    await expect(p()).rejects.toThrow(TypeError);
    await expect(p()).rejects.toThrow(/Invalid pipeline mode/);
  });

  it('accepts stop-on-first without error', async () => {
    const result = await pipeline<Ctx, TestErr>({ mode: 'stop-on-first' }).pipe(pass('A')).run(init);
    expect(result.ok).toBe(true);
  });

  it('accepts collect-all without error', async () => {
    const result = await pipeline<Ctx, TestErr>({ mode: 'collect-all' }).pipe(pass('A')).run(init);
    expect(result.ok).toBe(true);
  });
});

// ── condition exceptions (H-02) ───────────────────────────────────────────────

describe('condition exceptions', () => {
  it('condition that throws is treated as failure in stop-on-first', async () => {
    const result = await pipeline<Ctx, TestErr>()
      .pipe(pass('A'))
      .pipeIf(() => { throw new Error('condition exploded'); }, pass('B'))
      .pipe(pass('C'))
      .run(init);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.failedStep).toBe('B');
    expect(result.error.cause).toBeInstanceOf(Error);
    expect((result.error.cause as Error).message).toBe('condition exploded');
    expect(result.error.executedSteps).toEqual(['A']);
  });

  it('condition that throws is treated as failure in collect-all and continues', async () => {
    const result = await pipeline<Ctx, TestErr>({ mode: 'collect-all' })
      .pipe(pass('A'))
      .pipeIf(() => { throw new Error('condition exploded'); }, pass('B'))
      .pipe(pass('C'))
      .run(init);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.failures).toHaveLength(1);
    expect(result.error.failures[0].step).toBe('B');
    expect(result.error.executedSteps).toEqual(['A', 'B', 'C']);
  });
});

// ── invalid step result (H-05) ────────────────────────────────────────────────

describe('invalid step result', () => {
  it('step returning undefined is treated as failure', async () => {
    const step: PipelineStep<Ctx, TestErr> = {
      stepName: 'BadStep',
      async handle() { return undefined as unknown as StepResult<Ctx, TestErr>; },
    };

    const result = await pipeline<Ctx, TestErr>().pipe(step).run(init);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.failedStep).toBe('BadStep');
    expect(result.error.cause).toBeInstanceOf(TypeError);
    expect((result.error.cause as Error).message).toMatch(/invalid value/i);
  });

  it('step returning null is treated as failure', async () => {
    const step: PipelineStep<Ctx, TestErr> = {
      stepName: 'NullStep',
      async handle() { return null as unknown as StepResult<Ctx, TestErr>; },
    };

    const result = await pipeline<Ctx, TestErr>().pipe(step).run(init);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.failedStep).toBe('NullStep');
    expect(result.error.cause).toBeInstanceOf(TypeError);
  });

  it('step returning object without ok is treated as failure', async () => {
    const step: PipelineStep<Ctx, TestErr> = {
      stepName: 'NoOkStep',
      async handle() { return { value: 42 } as unknown as StepResult<Ctx, TestErr>; },
    };

    const result = await pipeline<Ctx, TestErr>().pipe(step).run(init);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.failedStep).toBe('NoOkStep');
    expect(result.error.cause).toBeInstanceOf(TypeError);
  });
});

// ── context mutation (convention, not enforced) ───────────────────────────────

describe('context mutation (convention, not enforced)', () => {
  it('QA-M-01: mutating ctx in-place is visible to onStepComplete hook', async () => {
    const onStepComplete = vi.fn();

    await pipeline<Ctx, TestErr>({ onStepComplete })
      .pipe({
        stepName: 'Mutator',
        async handle(ctx: Ctx): Promise<StepResult<Ctx, TestErr>> {
          ctx.value = 99; // in-place mutation — not recommended but works
          return Ok(ctx);
        },
      })
      .run(init);

    expect(onStepComplete).toHaveBeenCalledTimes(1);
    const ctxArg = onStepComplete.mock.calls[0][1] as Ctx;
    expect(ctxArg.value).toBe(99);
  });

  it('QA-M-01: mutating ctx in-place is visible to pipeIf condition of next step', async () => {
    const condition = vi.fn((ctx: Ctx) => ctx.value === 99);

    await pipeline<Ctx, TestErr>()
      .pipe({
        stepName: 'Mutator',
        async handle(ctx: Ctx): Promise<StepResult<Ctx, TestErr>> {
          ctx.value = 99; // in-place mutation — not recommended but works
          return Ok(ctx);
        },
      })
      .pipeIf(condition, pass('B'))
      .run(init);

    expect(condition).toHaveBeenCalledWith(expect.objectContaining({ value: 99 }));
    expect(condition).toHaveReturnedWith(true);
  });

  it('QA-L-04: pipeline accepts both immutable (recommended) and mutable (works but not recommended) patterns', async () => {
    // Immutable pattern — recommended
    const immutableResult = await pipeline<Ctx, TestErr>()
      .pipe({
        stepName: 'Immutable',
        async handle(ctx: Ctx): Promise<StepResult<Ctx, TestErr>> {
          return Ok({ ...ctx, value: 42, log: [...ctx.log, 'immutable'] });
        },
      })
      .run(init);

    expect(immutableResult.ok).toBe(true);
    if (!immutableResult.ok) return;
    expect(immutableResult.value.value).toBe(42);
    expect(immutableResult.value.log).toEqual(['immutable']);

    // Mutable pattern — works but not recommended, no runtime guard prevents it
    const mutableResult = await pipeline<Ctx, TestErr>()
      .pipe({
        stepName: 'Mutable',
        async handle(ctx: Ctx): Promise<StepResult<Ctx, TestErr>> {
          ctx.value = 7;   // in-place mutation
          ctx.log.push('mutable');
          return Ok(ctx);
        },
      })
      .run(init);

    expect(mutableResult.ok).toBe(true);
    if (!mutableResult.ok) return;
    expect(mutableResult.value.value).toBe(7);
    expect(mutableResult.value.log).toEqual(['mutable']);
  });
});
