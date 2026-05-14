export class PipelineToken<TContext, TError = unknown> {
  readonly description: string;
  readonly symbol:      symbol;

  // Phantom brand fields — exist only at the type level, never at runtime
  declare readonly _ctx: TContext;
  declare readonly _err: TError;

  constructor(name: string) {
    this.description = `Pipeline(${name})`;
    this.symbol      = Symbol(`Pipeline(${name})`);
  }
}

export function definePipeline<TContext, TError = unknown>(
  name: string,
): PipelineToken<TContext, TError> {
  return new PipelineToken<TContext, TError>(name);
}
