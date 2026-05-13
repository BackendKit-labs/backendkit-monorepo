/**
 * A discriminated union representing either a successful value (`ok: true`)
 * or a failure (`ok: false`). The error type `E` is fully generic.
 *
 * @example
 * function findUser(id: string): Result<User, 'not-found' | 'db-error'> { ... }
 */
export type Result<T, E = Error> =
  | { readonly ok: true;  readonly value: T }
  | { readonly ok: false; readonly error: E }

/**
 * A Result extended with observability metadata captured at execution time.
 * Produced by `track()` and `job()`.
 */
export type RichResult<T, E = Error> = Result<T, E> & {
  readonly durationMs:     number
  readonly timestamp:      string
  readonly operation?:     string
  readonly correlationId?: string
  readonly tags?:          string[]
}

/** Options for enriching a Result with observability metadata. */
export interface TrackOptions {
  operation?:     string
  correlationId?: string
  tags?:          string[]
}
