import { run, track } from '../result/run.js';
import type { TrackOptions } from '../result/types.js';

/**
 * Method decorator that wraps the return value in `run()`, converting any
 * thrown exception into a `Result<T, E>`.
 *
 * @example
 * @AsResult('user.find')
 * async findUser(id: string) {
 *   return this.db.users.findOrThrow(id);
 * }
 */
export function AsResult(operation?: string) {
  return function (
    _target: unknown,
    _key: string,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor {
    const original = descriptor.value as (...args: unknown[]) => unknown;
    descriptor.value = async function (...args: unknown[]) {
      return run(
        () => original.apply(this, args) as Promise<unknown>,
        undefined,
      );
    };
    if (operation) {
      (descriptor.value as { operationName?: string }).operationName = operation;
    }
    return descriptor;
  };
}

/**
 * Method decorator that wraps the return value in `track()`, capturing
 * execution duration, timestamp, and optional metadata.
 *
 * @example
 * @WithMetrics({ operation: 'payment.charge', tags: ['stripe'] })
 * async charge(dto: ChargeDto) {
 *   return this.stripe.charge(dto);
 * }
 */
export function WithMetrics(options?: string | TrackOptions) {
  const opts: TrackOptions =
    typeof options === 'string' ? { operation: options } : (options ?? {});

  return function (
    _target: unknown,
    _key: string,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor {
    const original = descriptor.value as (...args: unknown[]) => unknown;
    descriptor.value = async function (...args: unknown[]) {
      return track(() => original.apply(this, args) as Promise<unknown>, opts);
    };
    return descriptor;
  };
}
