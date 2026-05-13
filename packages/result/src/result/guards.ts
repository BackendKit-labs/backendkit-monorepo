import type { Result, RichResult } from './types.js';

type OkResult<T, E>   = Extract<Result<T, E>, { ok: true }>;
type FailResult<T, E> = Extract<Result<T, E>, { ok: false }>;

/** Narrows a `Result<T, E>` to its success branch. */
export function isOk<T, E>(result: Result<T, E>): result is OkResult<T, E> {
  return result.ok === true;
}

/** Narrows a `Result<T, E>` to its failure branch. */
export function isFail<T, E>(result: Result<T, E>): result is FailResult<T, E> {
  return result.ok === false;
}

/** Returns `true` if the result carries observability metadata (`track()` output). */
export function isRich<T, E>(result: Result<T, E>): result is RichResult<T, E> {
  return 'durationMs' in result;
}
