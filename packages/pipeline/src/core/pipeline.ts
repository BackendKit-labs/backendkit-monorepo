import type {
  PipelineMode,
  PipelineOptions,
  PipelineRunResult,
  PipelineStep,
  PipelineStepFailure,
  StepResult,
} from './types.js';

interface StepEntry<TContext, TError> {
  instance:   PipelineStep<TContext, TError>;
  name:       string;
  condition?: (ctx: TContext) => boolean;
}

interface ExecutionState<TContext, TError> {
  readonly mode:          PipelineMode;
  readonly start:         number;
  readonly executedSteps: string[];
  readonly failures:      PipelineStepFailure<TError>[];
  ctx:                    TContext;
}

const VALID_MODES: readonly PipelineMode[] = ['stop-on-first', 'collect-all'];

function normalizeMode(mode: unknown): PipelineMode {
  if (mode === 'stop-on-first' || mode === 'collect-all') {
    return mode;
  }
  throw new TypeError(
    `Invalid pipeline mode "${String(mode)}". Expected one of: ${VALID_MODES.map(m => `"${m}"`).join(', ')}`,
  );
}

function isStepResult<TContext, TError>(
  value: unknown,
): value is StepResult<TContext, TError> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'ok' in value &&
    typeof (value as Record<string, unknown>).ok === 'boolean'
  );
}

function buildErrorResult<TContext, TError>(
  state: ExecutionState<TContext, TError>,
  failedStep: string,
  cause: TError,
): PipelineRunResult<TContext, TError> {
  return {
    ok: false,
    error: {
      mode:          state.mode,
      failedStep,
      cause,
      executedSteps: [...state.executedSteps],
      durationMs:    Date.now() - state.start,
      failures:      [...state.failures],
    },
  };
}

function buildSuccessResult<TContext, TError>(
  state: ExecutionState<TContext, TError>,
): PipelineRunResult<TContext, TError> {
  return {
    ok: true,
    value:         state.ctx,
    executedSteps: [...state.executedSteps],
    durationMs:    Date.now() - state.start,
  };
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
    const state: ExecutionState<TContext, TError> = {
      mode:          normalizeMode(this.options.mode ?? 'stop-on-first'),
      start:         Date.now(),
      executedSteps: [],
      failures:      [],
      ctx:           initialCtx,
    };

    const { onStep, onStepComplete, onError, onComplete } = this.options;

    for (const entry of this.entries) {
      const shouldContinue = await this.#executeEntry(entry, state, { onStep, onStepComplete, onError });
      if (!shouldContinue) {
        return buildErrorResult(state, state.failures[state.failures.length - 1].step, state.failures[state.failures.length - 1].cause);
      }
    }

    if (state.failures.length > 0) {
      return buildErrorResult(state, state.failures[0].step, state.failures[0].cause);
    }

    const durationMs = Date.now() - state.start;
    try {
      await onComplete?.(state.ctx, durationMs, {
        executedSteps: [...state.executedSteps],
        failures:      [...state.failures],
      });
    } catch { /* noop */ }

    return buildSuccessResult(state);
  }

  async #executeEntry(
    entry: StepEntry<TContext, TError>,
    state: ExecutionState<TContext, TError>,
    hooks: {
      onStep?:         (stepName: string, ctx: TContext) => void | Promise<void>;
      onStepComplete?: (stepName: string, ctx: TContext, durationMs: number) => void | Promise<void>;
      onError?:        (stepName: string, error: TError) => void | Promise<void>;
    },
  ): Promise<boolean> {
    const { instance, name, condition } = entry;
    const { onStep, onStepComplete, onError } = hooks;

    // Evaluate condition — treat thrown exceptions as pipeline failures
    if (condition) {
      let shouldRun: boolean;
      try {
        shouldRun = condition(state.ctx);
      } catch (cause) {
        const error = cause instanceof Error ? cause : new Error(String(cause));
        state.failures.push({ step: name, cause: error as unknown as TError });

        if (state.mode === 'stop-on-first') {
          return false; // signal caller to stop
        }

        state.executedSteps.push(name);
        return true; // continue to next entry
      }

      if (!shouldRun) return true; // skip step, continue
    }

    try { await onStep?.(name, state.ctx); } catch { /* noop */ }

    const stepStart = Date.now();
    const rawResult = await instance.handle(state.ctx);
    const stepMs    = Date.now() - stepStart;

    // Validate step return value shape
    if (!isStepResult<TContext, TError>(rawResult)) {
      const error = new TypeError(
        `Step "${name}" returned an invalid value. Expected a StepResult (object with "ok" boolean), got ${typeof rawResult}`,
      );
      try { await onError?.(name, error as unknown as TError); } catch { /* noop */ }
      state.failures.push({ step: name, cause: error as unknown as TError });

      if (state.mode === 'stop-on-first') {
        return false;
      }

      state.executedSteps.push(name);
      return true;
    }

    const stepResult = rawResult;

    if (!stepResult.ok) {
      try { await onError?.(name, stepResult.error); } catch { /* noop */ }
      state.failures.push({ step: name, cause: stepResult.error });

      if (state.mode === 'stop-on-first') {
        return false;
      }

      state.executedSteps.push(name);
      return true;
    }

    state.ctx = stepResult.value;
    state.executedSteps.push(name);
    try { await onStepComplete?.(name, state.ctx, stepMs); } catch { /* noop */ }

    return true;
  }
}

export function pipeline<TContext, TError = unknown>(
  options?: PipelineOptions<TContext, TError>,
): Pipeline<TContext, TError> {
  return new Pipeline(options);
}
