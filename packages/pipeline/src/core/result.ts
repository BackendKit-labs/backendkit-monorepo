import type { StepResult } from './types.js';

export function Ok<TContext>(value: TContext): StepResult<TContext, never> {
  return { ok: true, value };
}

export function Err<TError>(error: TError): StepResult<never, TError> {
  return { ok: false, error };
}
