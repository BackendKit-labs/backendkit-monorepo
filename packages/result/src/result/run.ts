import type { Result, RichResult, TrackOptions } from './types.js';
import { ok, fail } from './constructors.js';

/**
 * Executes an async (or sync) function and captures any thrown exception,
 * returning a `Result<T, E>` instead of propagating the error.
 *
 * @example
 * const result = await run(() => fetchUser(id));
 * const result = await run(() => fetchUser(id), (e) => new UserError(e));
 */
export async function run<T, E = Error>(
  fn: () => T | Promise<T>,
  errorTransform?: (caught: unknown) => E,
): Promise<Result<T, E>> {
  try {
    return ok(await fn());
  } catch (caught) {
    return fail(errorTransform ? errorTransform(caught) : (caught as E));
  }
}

/**
 * Like `run()` but also captures timing and metadata, returning a `RichResult<T, E>`.
 *
 * @example
 * const result = await track(() => fetchUser(id), { operation: 'user.fetch', tags: ['db'] });
 */
export async function track<T, E = Error>(
  fn: () => T | Promise<T>,
  options?: TrackOptions & { errorTransform?: (caught: unknown) => E },
): Promise<RichResult<T, E>> {
  const start     = performance.now();
  const timestamp = new Date().toISOString();
  const meta = {
    durationMs:    0,
    timestamp,
    operation:     options?.operation,
    correlationId: options?.correlationId,
    tags:          options?.tags,
  };

  try {
    const value = await fn();
    return { ok: true, value, ...meta, durationMs: Math.round(performance.now() - start) };
  } catch (caught) {
    const error = options?.errorTransform ? options.errorTransform(caught) : (caught as E);
    return { ok: false, error, ...meta, durationMs: Math.round(performance.now() - start) };
  }
}

/**
 * Promotes a plain `Result<T, E>` to a `RichResult<T, E>` with a zero-duration snapshot.
 * Useful when you already have a Result and want to attach metadata.
 */
export function enrich<T, E>(result: Result<T, E>, options?: TrackOptions): RichResult<T, E> {
  return {
    ...result,
    durationMs:    0,
    timestamp:     new Date().toISOString(),
    operation:     options?.operation,
    correlationId: options?.correlationId,
    tags:          options?.tags,
  };
}

/**
 * Strips observability metadata from a `RichResult`, returning a plain `Result<T, E>`.
 */
export function simplify<T, E>(rich: RichResult<T, E>): Result<T, E> {
  return rich.ok
    ? { ok: true,  value: rich.value }
    : { ok: false, error: rich.error };
}
