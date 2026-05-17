export type StepResult<TContext, TError> =
  | { readonly ok: true;  readonly value: TContext }
  | { readonly ok: false; readonly error: TError   };

export interface PipelineStep<TContext, TError = unknown> {
  /** Optional human-readable name used in error reporting and hooks. Defaults to constructor.name. */
  readonly stepName?: string;

  /**
   * Execute this step against the given context.
   *
   * IMPORTANT — Immutability convention:
   * Steps SHOULD return a NEW context object rather than mutating the existing one.
   * Mutating `ctx` and returning `Ok(ctx)` is an anti-pattern that can cause subtle bugs
   * in hooks and subsequent steps. When in doubt, spread: `Ok({ ...ctx, ...changes })`.
   *
   * @param ctx - The current pipeline context (do NOT mutate in place).
   * @returns A StepResult — either `Ok(newCtx)` on success or `Err(error)` on failure.
   */
  handle(ctx: TContext): Promise<StepResult<TContext, TError>>;
}

export type PipelineMode = 'stop-on-first' | 'collect-all';

export interface PipelineStepFailure<TError> {
  readonly step:  string;
  readonly cause: TError;
}

export interface PipelineError<TError> {
  readonly mode:          PipelineMode;
  readonly failedStep:    string;
  readonly cause:         TError;
  readonly executedSteps: string[];
  readonly durationMs:    number;
  readonly failures:      PipelineStepFailure<TError>[];
}

export type PipelineRunResult<TContext, TError> =
  | { readonly ok: true;  readonly value: TContext; readonly executedSteps: string[]; readonly durationMs: number }
  | { readonly ok: false; readonly error: PipelineError<TError> };

export interface PipelineExecutionMetadata {
  readonly executedSteps: string[];
  readonly failures:      PipelineStepFailure<unknown>[];
}

export interface PipelineOptions<TContext, TError> {
  mode?:           PipelineMode;
  onStep?:         (stepName: string, ctx: TContext)                                                     => void | Promise<void>;
  onStepComplete?: (stepName: string, ctx: TContext, durationMs: number)                                 => void | Promise<void>;
  onError?:        (stepName: string, error: TError)                                                     => void | Promise<void>;
  onComplete?:     (ctx: TContext, durationMs: number, metadata: PipelineExecutionMetadata)              => void | Promise<void>;
}
