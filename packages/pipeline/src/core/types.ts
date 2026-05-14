export type StepResult<TContext, TError> =
  | { readonly ok: true;  readonly value: TContext }
  | { readonly ok: false; readonly error: TError   };

export interface PipelineStep<TContext, TError = unknown> {
  /** Optional human-readable name used in error reporting and hooks. Defaults to constructor.name. */
  readonly stepName?: string;
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

export interface PipelineOptions<TContext, TError> {
  mode?:           PipelineMode;
  onStep?:         (stepName: string, ctx: TContext)                     => void | Promise<void>;
  onStepComplete?: (stepName: string, ctx: TContext, durationMs: number) => void | Promise<void>;
  onError?:        (stepName: string, error: TError)                     => void | Promise<void>;
  onComplete?:     (ctx: TContext, durationMs: number)                   => void | Promise<void>;
}
