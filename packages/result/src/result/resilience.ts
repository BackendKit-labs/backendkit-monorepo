import type { Result } from './types.js';
import { fail } from './constructors.js';

export interface RetryOptions<E> {
  /** Maximum number of attempts (including the first). */
  attempts: number;
  /** Fixed delay in ms between attempts. Default: 0 */
  delayMs?: number;
  /** Return false to stop retrying early based on the error. */
  shouldRetry?: (error: E, attempt: number) => boolean;
  /** Called before each retry with the previous error and attempt number. */
  onRetry?: (error: E, attempt: number) => void;
}

export interface BackoffOptions<E> extends RetryOptions<E> {
  /** Cap for the computed backoff delay. Default: 30_000 */
  maxDelayMs?: number;
}

/**
 * Retries a Result-returning function up to `options.attempts` times with
 * an optional fixed delay between attempts.
 *
 * @example
 * const result = await retry(() => run(() => callApi()), {
 *   attempts: 3,
 *   delayMs:  500,
 *   shouldRetry: (err) => err.code === 'ECONNRESET',
 * });
 */
export async function retry<T, E = Error>(
  fn: () => Promise<Result<T, E>>,
  options: RetryOptions<E>,
): Promise<Result<T, E>> {
  let last!: Result<T, E>;

  for (let attempt = 1; attempt <= options.attempts; attempt++) {
    last = await fn();
    if (last.ok) return last;
    if (attempt === options.attempts) break;
    if (options.shouldRetry && !options.shouldRetry(last.error, attempt)) break;
    options.onRetry?.(last.error, attempt);
    if (options.delayMs) await sleep(options.delayMs);
  }

  return last;
}

/**
 * Like `retry()` but uses exponential backoff: delay doubles on each attempt,
 * capped at `maxDelayMs`.
 *
 * @example
 * const result = await retryWithBackoff(() => run(() => callApi()), {
 *   attempts:   4,
 *   delayMs:    100,    // 100ms → 200ms → 400ms
 *   maxDelayMs: 1_000,
 * });
 */
export async function retryWithBackoff<T, E = Error>(
  fn: () => Promise<Result<T, E>>,
  options: BackoffOptions<E>,
): Promise<Result<T, E>> {
  let last!: Result<T, E>;

  for (let attempt = 1; attempt <= options.attempts; attempt++) {
    last = await fn();
    if (last.ok) return last;
    if (attempt === options.attempts) break;
    if (options.shouldRetry && !options.shouldRetry(last.error, attempt)) break;
    options.onRetry?.(last.error, attempt);
    const delay = Math.min(
      (options.delayMs ?? 100) * Math.pow(2, attempt - 1),
      options.maxDelayMs ?? 30_000,
    );
    await sleep(delay);
  }

  return last;
}

/**
 * Races a Result-returning function against a timeout.
 * Returns `fail(timeoutError)` if `ms` elapses before the function resolves.
 *
 * @example
 * const result = await withTimeout(
 *   () => run(() => fetchData()),
 *   5_000,
 *   new TimeoutError('fetchData timed out'),
 * );
 */
export async function withTimeout<T, E>(
  fn: () => Promise<Result<T, E>>,
  ms: number,
  timeoutError: E,
): Promise<Result<T, E>> {
  const timer = new Promise<Result<T, E>>(resolve =>
    setTimeout(() => resolve(fail<T, E>(timeoutError)), ms),
  );
  return Promise.race([fn(), timer]);
}

const sleep = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms));
