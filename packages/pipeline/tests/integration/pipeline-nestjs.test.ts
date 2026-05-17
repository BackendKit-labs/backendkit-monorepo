import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { Injectable, Module } from '@nestjs/common';
import { PipelineModule } from '../../src/nestjs/pipeline.module.js';
import { InjectPipeline } from '../../src/nestjs/pipeline.decorator.js';
import { definePipeline, PipelineToken } from '../../src/core/define-pipeline.js';
import { Pipeline } from '../../src/core/pipeline.js';
import type { PipelineStep, PipelineRunResult, StepResult } from '../../src/core/types.js';

// ── Test steps ────────────────────────────────────────────────────────────────

interface Ctx {
  value: number;
  messages: string[];
}

interface TestErr {
  code: string;
}

@Injectable()
class DoubleStep implements PipelineStep<Ctx, TestErr> {
  async handle(ctx: Ctx): Promise<StepResult<Ctx, TestErr>> {
    return {
      ok: true,
      value: {
        ...ctx,
        value: ctx.value * 2,
        messages: [...ctx.messages, 'doubled'],
      },
    };
  }
}

@Injectable()
class AddOneStep implements PipelineStep<Ctx, TestErr> {
  async handle(ctx: Ctx): Promise<StepResult<Ctx, TestErr>> {
    return {
      ok: true,
      value: {
        ...ctx,
        value: ctx.value + 1,
        messages: [...ctx.messages, 'added_one'],
      },
    };
  }
}

@Injectable()
class FailingStep implements PipelineStep<Ctx, TestErr> {
  async handle(): Promise<StepResult<Ctx, TestErr>> {
    return { ok: false, error: { code: 'STEP_FAILED' } };
  }
}

// ── Service that uses injected pipeline ───────────────────────────────────────

const MATH_TOKEN = definePipeline<Ctx, TestErr>('math');

@Injectable()
class MathService {
  constructor(
    @InjectPipeline(MATH_TOKEN)
    private readonly pipeline: Pipeline<Ctx, TestErr>,
  ) {}

  async process(initial: Ctx): Promise<Ctx> {
    const result = await this.pipeline.run(initial);
    if (!result.ok) {
      throw new Error(`Pipeline failed at step "${result.error.failedStep}": ${JSON.stringify(result.error.cause)}`);
    }
    return result.value;
  }
}

// ── Integration tests ─────────────────────────────────────────────────────────

describe('NestJS Pipeline Integration', () => {
  it('creates a module with PipelineModule.forRoot() and resolves it', async () => {
    const modRef = await Test.createTestingModule({
      imports: [
        PipelineModule.forRoot({
          pipelines: [
            {
              token: MATH_TOKEN,
              steps: [DoubleStep, AddOneStep],
            },
          ],
        }),
      ],
      providers: [DoubleStep, AddOneStep, MathService],
    }).compile();

    expect(modRef).toBeDefined();
  });

  it('injects a pipeline via @InjectPipeline() and executes it successfully', async () => {
    const modRef = await Test.createTestingModule({
      imports: [
        PipelineModule.forRoot({
          pipelines: [
            {
              token: MATH_TOKEN,
              steps: [DoubleStep, AddOneStep],
            },
          ],
        }),
      ],
      providers: [DoubleStep, AddOneStep, MathService],
    }).compile();

    const service = modRef.get(MathService);
    const result = await service.process({ value: 5, messages: [] });

    expect(result.value).toBe(11); // (5*2)+1
    expect(result.messages).toEqual(['doubled', 'added_one']);
  });

  it('injects a pipeline and returns error when a step fails', async () => {
    const FAIL_TOKEN = definePipeline<Ctx, TestErr>('fail-test');

    @Injectable()
    class FailAwareService {
      constructor(
        @InjectPipeline(FAIL_TOKEN)
        private readonly pipeline: Pipeline<Ctx, TestErr>,
      ) {}

      async process(initial: Ctx): Promise<PipelineRunResult<Ctx, TestErr>> {
        return this.pipeline.run(initial);
      }
    }

    const modRef = await Test.createTestingModule({
      imports: [
        PipelineModule.forRoot({
          pipelines: [
            {
              token: FAIL_TOKEN,
              steps: [DoubleStep, FailingStep],
            },
          ],
        }),
      ],
      providers: [DoubleStep, FailingStep, FailAwareService],
    }).compile();

    const service = modRef.get(FailAwareService);
    const result = await service.process({ value: 10, messages: [] });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.failedStep).toBe('FailingStep');
    expect(result.error.cause).toEqual({ code: 'STEP_FAILED' });
  });

  it('runs a pipeline with multiple steps injected from DI', async () => {
    const MULTI_TOKEN = definePipeline<Ctx, TestErr>('multi');

    @Injectable()
    class MultiStepService {
      constructor(
        @InjectPipeline(MULTI_TOKEN)
        private readonly pipeline: Pipeline<Ctx, TestErr>,
      ) {}

      async runAll(initial: Ctx): Promise<Ctx> {
        const result = await this.pipeline.run(initial);
        if (!result.ok) {
          throw new Error('Pipeline failed');
        }
        return result.value;
      }
    }

    const modRef = await Test.createTestingModule({
      imports: [
        PipelineModule.forRoot({
          pipelines: [
            {
              token: MULTI_TOKEN,
              steps: [AddOneStep, DoubleStep, AddOneStep],
            },
          ],
        }),
      ],
      providers: [AddOneStep, DoubleStep, MultiStepService],
    }).compile();

    const service = modRef.get(MultiStepService);
    const result = await service.runAll({ value: 1, messages: [] });

    // (1+1)*2+1 = 5
    expect(result.value).toBe(5);
    expect(result.messages).toEqual(['added_one', 'doubled', 'added_one']);
  });
});
