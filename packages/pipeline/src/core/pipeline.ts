import type {
  PipelineOptions,
  PipelineRunResult,
  PipelineStep,
  PipelineStepFailure,
} from './types.js';

interface StepEntry<TContext, TError> {
  instance:   PipelineStep<TContext, TError>;
  name:       string;
  condition?: (ctx: TContext) => boolean;
}

export class Pipeline<TContext, TError = unknown> {
  private readonly entries: StepEntry<TContext, TError>[] = [];
  private readonly options: PipelineOptions<TContext, TError>;

  constructor(options: PipelineOptions<TContext, TError> = {}) {
    this.options = options;
  }

  pipe(step: PipelineStep<TContext, TError>): this {
    this.entries.push({
      instance: step,
      name:     step.stepName ?? step.constructor.name,
    });
    return this;
  }

  pipeIf(condition: (ctx: TContext) => boolean, step: PipelineStep<TContext, TError>): this {
    this.entries.push({
      instance:  step,
      name:      step.stepName ?? step.constructor.name,
      condition,
    });
    return this;
  }

  async run(initialCtx: TContext): Promise<PipelineRunResult<TContext, TError>> {
    const start = Date.now();
    const { mode = 'stop-on-first', onStep, onStepComplete, onError, onComplete } = this.options;
    const executedSteps: string[]                      = [];
    const failures:      PipelineStepFailure<TError>[] = [];
    let   ctx = initialCtx;

    for (const { instance, name, condition } of this.entries) {
      if (condition && !condition(ctx)) continue;

      await onStep?.(name, ctx);
      const stepStart  = Date.now();
      const stepResult = await instance.handle(ctx);
      const stepMs     = Date.now() - stepStart;

      if (!stepResult.ok) {
        await onError?.(name, stepResult.error);
        failures.push({ step: name, cause: stepResult.error });

        if (mode === 'stop-on-first') {
          return {
            ok:    false,
            error: {
              mode,
              failedStep:    name,
              cause:         stepResult.error,
              executedSteps: [...executedSteps],
              durationMs:    Date.now() - start,
              failures,
            },
          };
        }

        // collect-all: record the failed step and continue
        executedSteps.push(name);
        continue;
      }

      ctx = stepResult.value;
      executedSteps.push(name);
      await onStepComplete?.(name, ctx, stepMs);
    }

    if (failures.length > 0) {
      return {
        ok:    false,
        error: {
          mode,
          failedStep:    failures[0].step,
          cause:         failures[0].cause,
          executedSteps: [...executedSteps],
          durationMs:    Date.now() - start,
          failures,
        },
      };
    }

    const durationMs = Date.now() - start;
    await onComplete?.(ctx, durationMs);
    return { ok: true, value: ctx, executedSteps: [...executedSteps], durationMs };
  }
}

export function pipeline<TContext, TError = unknown>(
  options?: PipelineOptions<TContext, TError>,
): Pipeline<TContext, TError> {
  return new Pipeline(options);
}
