import type { Result } from './types.js';

/** Creates a successful Result. */
export const ok = <T, E = never>(value: T): Result<T, E> =>
  ({ ok: true, value });

/** Creates a failed Result. */
export const fail = <T = never, E = Error>(error: E): Result<T, E> =>
  ({ ok: false, error });

/**
 * Wraps a synchronous throwable function. Catches any thrown value and
 * passes it through `errorTransform` (defaults to identity cast).
 *
 * @example
 * const result = fromThrowable(() => JSON.parse(raw), (e) => new ParseError(e));
 */
export function fromThrowable<T, E = Error>(
  fn: () => T,
  errorTransform?: (caught: unknown) => E,
): Result<T, E> {
  try {
    return ok(fn());
  } catch (caught) {
    return fail(errorTransform ? errorTransform(caught) : (caught as E));
  }
}

/**
 * Converts a Promise to a `Promise<Result<T, E>>`, catching rejections.
 *
 * @example
 * const result = await fromPromise(fetch(url), (e) => new NetworkError(e));
 */
export async function fromPromise<T, E = Error>(
  promise: Promise<T>,
  errorTransform?: (caught: unknown) => E,
): Promise<Result<T, E>> {
  try {
    return ok(await promise);
  } catch (caught) {
    return fail(errorTransform ? errorTransform(caught) : (caught as E));
  }
}

/**
 * Converts a nullable value to a Result.
 * Returns `ok(value)` if non-null/undefined, `fail(error)` otherwise.
 *
 * @example
 * const result = fromNullable(user, new NotFoundError('user'));
 */
export function fromNullable<T, E>(
  value: T | null | undefined,
  error: E,
): Result<T, E> {
  return value != null ? ok(value) : fail(error);
}
