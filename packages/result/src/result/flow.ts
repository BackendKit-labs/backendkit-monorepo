import type { Result, RichResult } from './types.js';
import { ok, fail } from './constructors.js';
import { isRich } from './guards.js';

/**
 * Fluent pipeline wrapper around `Result<T, E>`.
 * Operations short-circuit on failure — subsequent transforms are skipped.
 *
 * @example
 * const price = Flow.from(findProduct(id))
 *   .map(p => p.price)
 *   .filter(price => price > 0, new Error('Price must be positive'))
 *   .map(price => price * taxRate)
 *   .getResult();
 */
export class Flow<T, E = Error> {
  private constructor(private readonly _result: Result<T, E>) {}

  /** Start a pipeline from an existing Result. */
  static from<T, E>(result: Result<T, E>): Flow<T, E> {
    return new Flow(result);
  }

  /** Start an empty pipeline (value is `undefined`). */
  static start(): Flow<void, never> {
    return new Flow(ok(undefined));
  }

  /** Maps the success value. Skipped on failure. */
  map<U>(fn: (value: T) => U): Flow<U, E> {
    if (!this._result.ok) return new Flow<U, E>(this._result as unknown as Result<U, E>);
    return new Flow(ok(fn(this._result.value)));
  }

  /** Maps the error value. Skipped on success. */
  mapError<F>(fn: (error: E) => F): Flow<T, F> {
    if (this._result.ok) return new Flow<T, F>(this._result as unknown as Result<T, F>);
    return new Flow(fail(fn(this._result.error)));
  }

  /** Chains a Result-returning function. Skipped on failure. */
  flatMap<U>(fn: (value: T) => Result<U, E>): Flow<U, E> {
    if (!this._result.ok) return new Flow<U, E>(this._result as unknown as Result<U, E>);
    return new Flow(fn(this._result.value));
  }

  /** Filters the success value. Becomes `fail(error)` if predicate is false. */
  filter(pred: (value: T) => boolean, error: E): Flow<T, E> {
    if (!this._result.ok) return this;
    return pred(this._result.value) ? this : new Flow(fail(error));
  }

  /** Runs a side effect on success; returns `this` unchanged. */
  tap(fn: (value: T) => void): this {
    if (this._result.ok) fn(this._result.value);
    return this;
  }

  /** Runs a side effect on failure; returns `this` unchanged. */
  tapError(fn: (error: E) => void): this {
    if (!this._result.ok) fn(this._result.error);
    return this;
  }

  /**
   * Recovers from a failure by computing a new success value.
   * Skipped if already Ok.
   */
  recover(fn: (error: E) => T): Flow<T, never> {
    if (this._result.ok) return new Flow<T, never>(this._result as unknown as Result<T, never>);
    return new Flow(ok(fn(this._result.error)));
  }

  /** Exhaustive pattern match — always produces a value. */
  match<R>(handlers: { ok: (value: T) => R; fail: (error: E) => R }): R {
    return this._result.ok
      ? handlers.ok(this._result.value)
      : handlers.fail(this._result.error);
  }

  /** Returns the underlying `Result<T, E>`. */
  getResult(): Result<T, E> {
    return this._result;
  }

  /**
   * Returns the underlying result as `RichResult<T, E>` if it was created by `track()`.
   * Throws if the result has no observability metadata.
   */
  getRichResult(): RichResult<T, E> {
    if (!isRich(this._result)) throw new Error('Result is not a RichResult');
    return this._result;
  }

  isOk(): boolean   { return this._result.ok; }
  isFail(): boolean { return !this._result.ok; }
}
