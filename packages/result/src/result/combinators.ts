import type { Result } from './types.js';
import { ok } from './constructors.js';

/**
 * Returns `ok([...values])` if every result succeeds, or the first `fail` encountered.
 *
 * @example
 * const result = all([findUser(id), findAccount(id)]);
 * // Result<[User, Account], Error>
 */
export function all<T, E>(results: Result<T, E>[]): Result<T[], E> {
  const values: T[] = [];
  for (const r of results) {
    if (!r.ok) return r;
    values.push(r.value);
  }
  return ok(values);
}

/**
 * Returns the first successful result from a list of async operations,
 * tried sequentially. Returns the last failure if all fail.
 *
 * @example
 * const result = await any([
 *   () => run(() => primaryCache.get(key)),
 *   () => run(() => database.find(key)),
 * ]);
 */
export async function any<T, E>(
  operations: (() => Promise<Result<T, E>>)[],
): Promise<Result<T, E>> {
  let last!: Result<T, E>;
  for (const op of operations) {
    last = await op();
    if (last.ok) return last;
  }
  return last;
}

export interface ParallelOptions {
  /** Max number of operations running concurrently. Default: all at once. */
  concurrency?: number;
}

/**
 * Runs operations concurrently (optionally throttled by `concurrency`).
 * Returns `ok([...values])` if all succeed, or the first failure.
 *
 * @example
 * const result = await parallel(
 *   userIds.map(id => () => run(() => fetchUser(id))),
 *   { concurrency: 5 },
 * );
 */
export async function parallel<T, E>(
  operations: (() => Promise<Result<T, E>>)[],
  options?: ParallelOptions,
): Promise<Result<T[], E>> {
  const concurrency = options?.concurrency ?? operations.length;
  const results: Result<T, E>[] = [];

  for (let i = 0; i < operations.length; i += concurrency) {
    const batch = await Promise.all(operations.slice(i, i + concurrency).map(op => op()));
    results.push(...batch);
  }

  return all(results);
}

/**
 * Splits an array of Results into `[successValues, errorValues]`.
 *
 * @example
 * const [users, errors] = partition(results);
 */
export function partition<T, E>(results: Result<T, E>[]): [T[], E[]] {
  const values: T[] = [];
  const errors: E[] = [];
  for (const r of results) {
    if (r.ok) values.push(r.value);
    else errors.push(r.error);
  }
  return [values, errors];
}

/**
 * Extracts only the success values, silently discarding failures.
 *
 * @example
 * const users = collect(results); // User[]
 */
export function collect<T, E>(results: Result<T, E>[]): T[] {
  return results
    .filter((r): r is Extract<Result<T, E>, { ok: true }> => r.ok)
    .map(r => r.value);
}

/**
 * Maps each item through a Result-returning function, collecting all successes
 * into an array or short-circuiting on the first failure.
 *
 * @example
 * const result = traverse(ids, id => fromNullable(cache.get(id), 'not-found'));
 */
export function traverse<T, U, E>(
  items: T[],
  fn: (item: T) => Result<U, E>,
): Result<U[], E> {
  return all(items.map(fn));
}

// ── Typed tuple combinators ────────────────────────────────────────────────

/** Combines two Results into a tuple. Short-circuits on first failure. */
export function combine2<A, B, E>(
  r1: Result<A, E>,
  r2: Result<B, E>,
): Result<[A, B], E> {
  if (!r1.ok) return r1;
  if (!r2.ok) return r2;
  return ok([r1.value, r2.value]);
}

/** Combines three Results into a typed tuple. Short-circuits on first failure. */
export function combine3<A, B, C, E>(
  r1: Result<A, E>,
  r2: Result<B, E>,
  r3: Result<C, E>,
): Result<[A, B, C], E> {
  if (!r1.ok) return r1;
  if (!r2.ok) return r2;
  if (!r3.ok) return r3;
  return ok([r1.value, r2.value, r3.value]);
}
