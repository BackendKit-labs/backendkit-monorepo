import { describe, expect, it } from 'vitest';
import { PipelineModule } from '../../../src/nestjs/pipeline.module.js';
import { InjectPipeline } from '../../../src/nestjs/pipeline.decorator.js';
import { definePipeline } from '../../../src/core/define-pipeline.js';
import type { PipelineStep, StepResult } from '../../../src/core/types.js';

interface Ctx {
  value: number;
}

interface TestErr {
  code: string;
}

class SimpleStep implements PipelineStep<Ctx, TestErr> {
  async handle(ctx: Ctx): Promise<StepResult<Ctx, TestErr>> {
    return { ok: true, value: { ...ctx, value: ctx.value + 1 } };
  }
}

class FailingStep implements PipelineStep<Ctx, TestErr> {
  async handle(): Promise<StepResult<Ctx, TestErr>> {
    return { ok: false, error: { code: 'FAILED' } };
  }
}

// ── forRoot() ─────────────────────────────────────────────────────────────────

describe('PipelineModule.forRoot()', () => {
  it('registers providers for a valid pipeline definition', () => {
    const token = definePipeline<Ctx, TestErr>('test');
    const mod = PipelineModule.forRoot({
      pipelines: [
        {
          token,
          steps: [SimpleStep],
        },
      ],
    });

    expect(mod.module).toBe(PipelineModule);
    expect(mod.global).toBe(true);
    expect(mod.providers).toHaveLength(2); // SimpleStep + Pipeline
    expect(mod.exports).toHaveLength(2);
  });

  it('registers nothing when pipelines array is empty', () => {
    const mod = PipelineModule.forRoot({ pipelines: [] });

    expect(mod.providers).toHaveLength(0);
    expect(mod.exports).toHaveLength(0);
  });

  it('throws when a pipeline definition has no steps', () => {
    const token = definePipeline<Ctx, TestErr>('empty');

    expect(() =>
      PipelineModule.forRoot({
        pipelines: [
          { token, steps: [] },
        ],
      }),
    ).toThrow(/no steps/i);
  });

  it('throws when a pipeline definition is missing token', () => {
    expect(() =>
      PipelineModule.forRoot({
        pipelines: [
          // @ts-expect-error — testing missing token
          { steps: [SimpleStep] },
        ],
      }),
    ).toThrow(/missing "token"/i);
  });

  it('throws when a step is not a constructor/class', () => {
    const token = definePipeline<Ctx, TestErr>('bad-step');

    expect(() =>
      PipelineModule.forRoot({
        pipelines: [
          {
            token,
            // @ts-expect-error — testing non-class step
            steps: ['not-a-class'],
          },
        ],
      }),
    ).toThrow(/not a class/i);
  });

  it('throws when a step instance does not implement PipelineStep', () => {
    const token = definePipeline<Ctx, TestErr>('bad-instance');

    const mod = PipelineModule.forRoot({
      pipelines: [
        {
          token,
          steps: [SimpleStep],
        },
      ],
    });

    // The factory will throw at runtime when useFactory is called with a non-step instance
    const factory = mod.providers[1] as { useFactory: (...args: unknown[]) => unknown };
    expect(() => factory.useFactory({})).toThrow(/does not implement PipelineStep/i);
  });
});

// ── InjectPipeline decorator ──────────────────────────────────────────────────

describe('InjectPipeline', () => {
  it('returns the result of Inject with the token symbol', () => {
    const token = definePipeline<Ctx, TestErr>('my-pipeline');
    const decorator = InjectPipeline(token);

    // Inject returns a PropertyDescriptor decorator function
    expect(decorator).toBeInstanceOf(Function);
  });
});

// ── definePipeline ────────────────────────────────────────────────────────────

describe('definePipeline', () => {
  it('creates a PipelineToken with a unique symbol', () => {
    const tokenA = definePipeline<Ctx, TestErr>('pipeline-A');
    const tokenB = definePipeline<Ctx, TestErr>('pipeline-B');

    expect(tokenA.description).toBe('Pipeline(pipeline-A)');
    expect(tokenB.description).toBe('Pipeline(pipeline-B)');
    expect(tokenA.symbol).not.toBe(tokenB.symbol);
  });

  it('creates tokens with the same name that are still unique', () => {
    const token1 = definePipeline<Ctx, TestErr>('same-name');
    const token2 = definePipeline<Ctx, TestErr>('same-name');

    expect(token1.description).toBe(token2.description);
    expect(token1.symbol).not.toBe(token2.symbol);
  });
});
