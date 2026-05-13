import type { Result } from './types.js';
import { ok, fail } from './constructors.js';

// ── Transformations ────────────────────────────────────────────────────────

/** Maps the success value. Passes failures through unchanged. */
export function map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  return result.ok ? ok(fn(result.value)) : result;
}

/** Maps the error value. Passes successes through unchanged. */
export function mapError<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> {
  return result.ok ? result : fail(fn(result.error));
}

/** Monadic bind — chains a Result-returning function on success. */
export function flatMap<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>,
): Result<U, E> {
  return result.ok ? fn(result.value) : result;
}

/** Async variant of `flatMap`. */
export async function flatMapAsync<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Promise<Result<U, E>>,
): Promise<Result<U, E>> {
  return result.ok ? fn(result.value) : Promise.resolve(result);
}

/** Async variant of `map`. */
export async function mapAsync<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Promise<U>,
): Promise<Result<U, E>> {
  if (!result.ok) return Promise.resolve(result);
  return ok(await fn(result.value));
}

// ── Pattern matching ───────────────────────────────────────────────────────

/**
 * Exhaustive pattern match over both branches.
 *
 * @example
 * const msg = match(result, {
 *   ok:   (user)  => `Welcome, ${user.name}`,
 *   fail: (error) => `Error: ${error.message}`,
 * });
 */
export function match<T, E, R>(
  result: Result<T, E>,
  handlers: { ok: (value: T) => R; fail: (error: E) => R },
): R {
  return result.ok ? handlers.ok(result.value) : handlers.fail(result.error);
}

/** Alias for `match` — familiar to fp-ts / Scala users. */
export const fold = match;

// ── Side effects ───────────────────────────────────────────────────────────

/** Runs a side effect on the success value; returns the result unchanged. */
export function tap<T, E>(result: Result<T, E>, fn: (value: T) => void): Result<T, E> {
  if (result.ok) fn(result.value);
  return result;
}

/** Runs a side effect on the error value; returns the result unchanged. */
export function tapError<T, E>(result: Result<T, E>, fn: (error: E) => void): Result<T, E> {
  if (!result.ok) fn(result.error);
  return result;
}

// ── Unwrapping ─────────────────────────────────────────────────────────────

/** Extracts the value or throws the error (re-thrown as-is if it's an Error, wrapped otherwise). */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (result.ok) return result.value;
  throw result.error instanceof Error ? result.error : new Error(String(result.error));
}

/** Extracts the error or throws if the result is Ok. */
export function unwrapError<T, E>(result: Result<T, E>): E {
  if (!result.ok) return result.error;
  throw new Error('Called unwrapError on an Ok result');
}

/** Extracts the value or returns `defaultValue` on failure. */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  return result.ok ? result.value : defaultValue;
}

/** Extracts the value or computes a fallback from the error. */
export function unwrapOrElse<T, E>(result: Result<T, E>, fn: (error: E) => T): T {
  return result.ok ? result.value : fn(result.error);
}

/** Extracts the value or throws with a custom `message`. */
export function expect<T, E>(result: Result<T, E>, message: string): T {
  if (result.ok) return result.value;
  throw new Error(message);
}

// ── Conversion ─────────────────────────────────────────────────────────────

/** Converts to a Promise — resolves on Ok, rejects on Fail. */
export function toPromise<T, E>(result: Result<T, E>): Promise<T> {
  return result.ok ? Promise.resolve(result.value) : Promise.reject(result.error);
}

/** Returns the value or `null` on failure. */
export function toNullable<T, E>(result: Result<T, E>): T | null {
  return result.ok ? result.value : null;
}

/** Returns the value or `undefined` on failure. */
export function toUndefined<T, E>(result: Result<T, E>): T | undefined {
  return result.ok ? result.value : undefined;
}
